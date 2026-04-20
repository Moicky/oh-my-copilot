import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function runOmx(cwd: string, argv: string[]) {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..', '..', '..');
  const omxBin = join(repoRoot, 'dist', 'cli', 'omcp.js');
  return spawnSync(process.execPath, [omxBin, ...argv], {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      OMCP_AUTO_UPDATE: '0',
      OMCP_NOTIFY_FALLBACK: '0',
      OMCP_HOOK_DERIVED_SIGNALS: '0',
    },
  });
}

describe('nested help routing', () => {
  for (const [argv, expectedUsage] of [
    [['adapt', '--help'], /Usage:\s*omcp adapt <target> <probe\|status\|init\|envelope\|doctor>/i],
    [['ask', '--help'], /Usage:\s*omcp ask <claude\|gemini> <question or task>/i],
    [['question', '--help'], /omcp question - OMCP-owned blocking user question entrypoint/i],
    [['autoresearch', '--help'], /hard-deprecated legacy command surface[\s\S]*\$autoresearch/i],
    [['hud', '--help'], /Usage:\s*\n\s*omcp hud\s+Show current HUD state/i],
    [['hooks', '--help'], /Usage:\s*\n\s*omcp hooks init/i],
    [['state', '--help'], /Usage:\s*omcp state <read\|write\|clear\|list-active\|get-status>/i],
    [['tmux-hook', '--help'], /Usage:\s*\n\s*omcp tmux-hook init/i],
    [['ralph', '--help'], /omcp ralph - Launch Codex with ralph persistence mode active/i],
  ] satisfies Array<[string[], RegExp]>) {
    it(`routes ${argv.join(' ')} to command-local help`, async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'omcp-nested-help-'));
      try {
        const result = runOmx(cwd, argv);
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, expectedUsage);
        assert.doesNotMatch(result.stdout, /oh-my-copilot \(omcp\) - Multi-agent orchestration for Codex CLI/i);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  }

  it('routes `omcp state read` through the top-level CLI', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'omcp-state-route-'));
    try {
      const result = runOmx(cwd, ['state', 'read', '--input', '{"mode":"ralph"}', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout.trim(), /^\{"exists":false,"mode":"ralph"\}$/);
      assert.doesNotMatch(result.stdout, /Unknown command: state/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
