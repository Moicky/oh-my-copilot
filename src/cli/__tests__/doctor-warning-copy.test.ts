import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withPackagedExploreHarnessHidden, withPackagedExploreHarnessLock } from './packaged-explore-harness-lock.js';
import { checkExploreHarness } from '../doctor.js';

function runOmcp(
  cwd: string,
  argv: string[],
  envOverrides: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string; error?: string } {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..', '..', '..');
  const omcpBin = join(repoRoot, 'dist', 'cli', 'omcp.js');
  const mergedEnv = { ...process.env, ...envOverrides };
  if (typeof envOverrides.HOME === 'string' && typeof envOverrides.USERPROFILE !== 'string') {
    mergedEnv.USERPROFILE = envOverrides.HOME;
  }
  const r = spawnSync(process.execPath, [omcpBin, ...argv], {
    cwd,
    encoding: 'utf-8',
    env: mergedEnv,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error?.message };
}

function shouldSkipForSpawnPermissions(err?: string): boolean {
  return typeof err === 'string' && /(EPERM|EACCES)/i.test(err);
}

describe('omcp doctor onboarding warning copy', () => {
  it('warns that the built-in explore harness is not ready on Windows', () => {
    const check = checkExploreHarness('win32', {} as NodeJS.ProcessEnv);

    assert.equal(check.name, 'Explore Harness');
    assert.equal(check.status, 'warn');
    assert.match(check.message, /not ready on Windows/i);
    assert.match(check.message, /OMCP_EXPLORE_BIN/);
  });

  it('explains first-setup expectation for config and MCP onboarding warnings', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-copy-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'config.toml'),
        `
[mcp_servers.non_omcp]
command = "node"
`.trimStart(),
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: join(home, '.copilot'),
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Config: config\.toml exists but no OMCP entries yet \(expected before first setup; run "omcp setup --force" once\)/,
      );
      assert.match(
        res.stdout,
        /MCP Servers: 1 servers but no OMCP servers yet \(expected before first setup; run "omcp setup --force" once\)/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('warns about retired omcp_team_run config left behind after upgrade', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-copy-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'config.toml'),
        `
[mcp_servers.omcp_team_run]
command = "node"
args = ["/tmp/team-server.js"]
enabled = true
`.trimStart(),
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: join(home, '.copilot'),
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Config: retired \[mcp_servers\.omcp_team_run\] table still present; run "omcp setup --force" to repair the config/,
      );
      assert.match(
        res.stdout,
        /MCP Servers: 1 servers configured, but retired \[mcp_servers\.omcp_team_run\] is not supported; run "omcp setup --force" to repair the config/,
      );
      assert.doesNotMatch(res.stdout, /Config: config\.toml has OMCP entries/);
      assert.doesNotMatch(
        res.stdout,
        /MCP Servers: 1 servers but no OMCP servers yet \(expected before first setup; run "omcp setup --force" once\)/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('warns when explore harness sources are packaged but cargo is unavailable', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-explore-copy-'));
    try {
      await withPackagedExploreHarnessHidden(async () => {
        const home = join(wd, 'home');
        const codexDir = join(home, '.copilot');
        const fakeBin = join(wd, 'bin');
        await mkdir(codexDir, { recursive: true });
        await mkdir(fakeBin, { recursive: true });
        await writeFile(join(fakeBin, 'copilot'), '#!/bin/sh\necho "codex test"\n');
        spawnSync('chmod', ['+x', join(fakeBin, 'copilot')], { encoding: 'utf-8' });

        const res = runOmcp(wd, ['doctor'], {
          HOME: home,
          COPILOT_HOME: join(home, '.copilot'),
          PATH: fakeBin,
        });
        if (shouldSkipForSpawnPermissions(res.error)) return;
        assert.equal(res.status, 0, res.stderr || res.stdout);
        assert.match(
          res.stdout,
          /Explore Harness: (Rust harness sources are packaged, but no compatible packaged prebuilt or cargo was found \(install Rust or set OMCP_EXPLORE_BIN for omcp explore\)|not ready \(no packaged binary, OMCP_EXPLORE_BIN, or cargo toolchain\))/,
        );
      });
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('passes explore harness check when a packaged native binary is present even without cargo', async () => {
    await withPackagedExploreHarnessLock(async () => {
      const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-explore-binary-'));
      try {
        const home = join(wd, 'home');
        const codexDir = join(home, '.copilot');
        const fakeBin = join(wd, 'bin');
        const packageBinDir = join(process.cwd(), 'bin');
        const packagedBinary = join(packageBinDir, process.platform === 'win32' ? 'omcp-explore-harness.exe' : 'omcp-explore-harness');
        const packagedMeta = join(packageBinDir, 'omcp-explore-harness.meta.json');
        const hadExistingBinary = existsSync(packagedBinary);
        const hadExistingMeta = existsSync(packagedMeta);

        await mkdir(codexDir, { recursive: true });
        await mkdir(fakeBin, { recursive: true });
        await writeFile(join(fakeBin, 'copilot'), '#!/bin/sh\necho "codex test"\n');
        spawnSync('chmod', ['+x', join(fakeBin, 'copilot')], { encoding: 'utf-8' });
        const fsPromises = await import('node:fs/promises');
        const originalBinary = hadExistingBinary ? await fsPromises.readFile(packagedBinary) : null;
        const originalMeta = hadExistingMeta ? await fsPromises.readFile(packagedMeta, 'utf-8') : null;
        await mkdir(packageBinDir, { recursive: true });
        await writeFile(packagedBinary, '#!/bin/sh\necho "stub harness"\n');
        await writeFile(packagedMeta, JSON.stringify({ binaryName: process.platform === 'win32' ? 'omcp-explore-harness.exe' : 'omcp-explore-harness', platform: process.platform, arch: process.arch }));
        spawnSync('chmod', ['+x', packagedBinary], { encoding: 'utf-8' });

        try {
          const res = runOmcp(wd, ['doctor'], {
            HOME: home,
            COPILOT_HOME: join(home, '.copilot'),
            PATH: fakeBin,
          });
          if (shouldSkipForSpawnPermissions(res.error)) return;
          assert.equal(res.status, 0, res.stderr || res.stdout);
          assert.match(
            res.stdout,
            /Explore Harness: ready \(packaged native binary:/,
          );
        } finally {
          if (originalBinary) {
            await writeFile(packagedBinary, originalBinary);
            spawnSync('chmod', ['+x', packagedBinary], { encoding: 'utf-8' });
          } else {
            await rm(packagedBinary, { force: true });
          }
          if (originalMeta !== null) {
            await writeFile(packagedMeta, originalMeta);
          } else {
            await rm(packagedMeta, { force: true });
          }
        }
      } finally {
        await rm(wd, { recursive: true, force: true });
      }
    });
  });

  it('warns when explore routing is explicitly disabled in config.toml', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-explore-routing-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'config.toml'),
        `
[env]
USE_OMX_EXPLORE_CMD = "off"
`.trimStart(),
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: join(home, '.copilot'),
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Explore routing: disabled in config\.toml \[env\]; set USE_OMX_EXPLORE_CMD = "1" to restore default explore-first routing/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('warns when canonical and legacy skill roots overlap', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-skill-overlap-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      const canonicalHelp = join(codexDir, 'skills', 'help');
      const canonicalPlan = join(codexDir, 'skills', 'plan');
      const legacyHelp = join(home, '.agents', 'skills', 'help');
      await mkdir(canonicalHelp, { recursive: true });
      await mkdir(canonicalPlan, { recursive: true });
      await mkdir(legacyHelp, { recursive: true });
      await writeFile(join(canonicalHelp, 'SKILL.md'), '# canonical help\n');
      await writeFile(join(canonicalPlan, 'SKILL.md'), '# canonical plan\n');
      await writeFile(join(legacyHelp, 'SKILL.md'), '# legacy help\n');

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: codexDir,
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Legacy skill roots: 1 overlapping skill names between .*\.copilot[\\/]+skills and .*\.agents[\\/]+skills; 1 differ in SKILL\.md content; Codex Enable\/Disable Skills may show duplicates until ~\/\.agents\/skills is cleaned up/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('warns when hooks.json is missing OMCP-managed native hook coverage', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-hooks-coverage-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'hooks.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  hooks: [
                    {
                      type: 'command',
                      command: 'node "/repo/dist/scripts/codex-native-hook.js"',
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: codexDir,
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Native hooks: hooks\.json is missing OMCP-managed coverage for PreToolUse, PostToolUse, UserPromptSubmit, Stop; run "omcp setup --force" to restore native hooks/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('warns when hooks.json is missing after OMCP config was already installed', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-hooks-missing-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(
        join(codexDir, 'config.toml'),
        `
omcp_enabled = true
[mcp_servers.omcp_state]
command = "node"
`.trimStart(),
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: codexDir,
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Native hooks: hooks\.json not found even though config\.toml has OMCP entries; run "omcp setup --force" to restore native hook coverage/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('fails when hooks.json is invalid and native hook coverage cannot be read', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-hooks-invalid-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      await mkdir(codexDir, { recursive: true });
      await writeFile(join(codexDir, 'hooks.json'), '{invalid json\n');

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: codexDir,
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /\[XX\] Native hooks: invalid hooks\.json; Codex may skip OMCP hook coverage until "omcp setup --force" repairs it/,
      );
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it('passes when legacy skill root is a link to the canonical skills directory', async () => {
    const wd = await mkdtemp(join(tmpdir(), 'omcp-doctor-skill-link-'));
    try {
      const home = join(wd, 'home');
      const codexDir = join(home, '.copilot');
      const canonicalSkillsRoot = join(codexDir, 'skills');
      const canonicalHelp = join(canonicalSkillsRoot, 'help');
      const legacyRoot = join(home, '.agents', 'skills');
      await mkdir(canonicalHelp, { recursive: true });
      await mkdir(join(home, '.agents'), { recursive: true });
      await writeFile(join(canonicalHelp, 'SKILL.md'), '# canonical help\n');
      await symlink(
        canonicalSkillsRoot,
        legacyRoot,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      const res = runOmcp(wd, ['doctor'], {
        HOME: home,
        COPILOT_HOME: codexDir,
      });
      if (shouldSkipForSpawnPermissions(res.error)) return;
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(
        res.stdout,
        /Legacy skill roots: ~\/\.agents\/skills links to canonical .*\.copilot[\\/]+skills; treating both paths as one shared skill root/,
      );
      assert.doesNotMatch(res.stdout, /\[!!\] Legacy skill roots:/);
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });
});
