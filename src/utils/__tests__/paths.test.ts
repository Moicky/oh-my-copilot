import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { homedir, tmpdir } from "os";
import { existsSync } from "fs";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "fs/promises";
import {
  copilotHome,
  copilotConfigPath,
  copilotPromptsDir,
  userSkillsDir,
  projectSkillsDir,
  legacyUserSkillsDir,
  listInstalledSkillDirectories,
  detectLegacySkillRootOverlap,
  omcpStateDir,
  omcpProjectMemoryPath,
  omcpNotepadPath,
  omcpPlansDir,
  omcpAdaptersDir,
  omcpLogsDir,
  packageRoot,
  OMCP_ENTRY_PATH_ENV,
  OMCP_STARTUP_CWD_ENV,
  rememberOmcpLaunchContext,
  resolveOmcpCliEntryPath,
  resolveOmcpEntryPath,
} from "../paths.js";

describe("copilotHome", () => {
  let originalCodexHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalCodexHome = process.env.COPILOT_HOME;
    originalUserProfile = process.env.USERPROFILE;
  });

  afterEach(() => {
    if (typeof originalCodexHome === "string") {
      process.env.COPILOT_HOME = originalCodexHome;
    } else {
      delete process.env.COPILOT_HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("returns COPILOT_HOME env var when set", () => {
    process.env.COPILOT_HOME = "/tmp/custom-codex";
    assert.equal(copilotHome(), "/tmp/custom-codex");
  });

  it("defaults to ~/.codex when COPILOT_HOME is not set", () => {
    delete process.env.COPILOT_HOME;
    assert.equal(copilotHome(), join(homedir(), ".copilot"));
  });
});

describe("copilotConfigPath", () => {
  let originalCodexHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalCodexHome = process.env.COPILOT_HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.COPILOT_HOME = "/tmp/test-codex";
  });

  afterEach(() => {
    if (typeof originalCodexHome === "string") {
      process.env.COPILOT_HOME = originalCodexHome;
    } else {
      delete process.env.COPILOT_HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("returns config.toml under codex home", () => {
    assert.equal(copilotConfigPath(), join("/tmp/test-codex", "config.toml"));
  });
});

describe("copilotPromptsDir", () => {
  let originalCodexHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalCodexHome = process.env.COPILOT_HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.COPILOT_HOME = "/tmp/test-codex";
  });

  afterEach(() => {
    if (typeof originalCodexHome === "string") {
      process.env.COPILOT_HOME = originalCodexHome;
    } else {
      delete process.env.COPILOT_HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("returns prompts/ under codex home", () => {
    assert.equal(copilotPromptsDir(), join("/tmp/test-codex", "prompts"));
  });
});

describe("userSkillsDir", () => {
  let originalCodexHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalCodexHome = process.env.COPILOT_HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.COPILOT_HOME = "/tmp/test-codex";
  });

  afterEach(() => {
    if (typeof originalCodexHome === "string") {
      process.env.COPILOT_HOME = originalCodexHome;
    } else {
      delete process.env.COPILOT_HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("returns COPILOT_HOME/skills", () => {
    assert.equal(userSkillsDir(), join("/tmp/test-codex", "skills"));
  });
});

describe("projectSkillsDir", () => {
  it("uses provided projectRoot", () => {
    assert.equal(projectSkillsDir("/my/project"), join("/my/project", ".copilot", "skills"));
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(projectSkillsDir(), join(process.cwd(), ".copilot", "skills"));
  });
});

describe("legacyUserSkillsDir", () => {
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = "/tmp/test-home";
    process.env.USERPROFILE = "/tmp/test-home";
  });

  afterEach(() => {
    if (typeof originalHome === "string") {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("returns ~/.agents/skills under HOME", () => {
    assert.equal(legacyUserSkillsDir(), join("/tmp/test-home", ".agents", "skills"));
  });
});

describe("omcpAdaptersDir", () => {
  it("returns .omcp/adapters under the project root", () => {
    assert.equal(omcpAdaptersDir("/my/project"), join("/my/project", ".omcp", "adapters"));
  });
});

describe("listInstalledSkillDirectories", () => {
  let originalCodexHome: string | undefined;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalCodexHome = process.env.COPILOT_HOME;
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
  });

  afterEach(() => {
    if (typeof originalCodexHome === "string") {
      process.env.COPILOT_HOME = originalCodexHome;
    } else {
      delete process.env.COPILOT_HOME;
    }

    if (typeof originalHome === "string") {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    if (typeof originalUserProfile === "string") {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
  });

  it("deduplicates by skill name and prefers project skills over user skills", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "omcp-paths-project-"));
    const codexHomeRoot = await mkdtemp(join(tmpdir(), "omcp-paths-codex-"));
    process.env.COPILOT_HOME = codexHomeRoot;

    try {
      const projectHelpDir = join(projectRoot, ".copilot", "skills", "help");
      const projectOnlyDir = join(
        projectRoot,
        ".copilot",
        "skills",
        "project-only",
      );
      const userHelpDir = join(codexHomeRoot, "skills", "help");
      const userOnlyDir = join(codexHomeRoot, "skills", "user-only");

      await mkdir(projectHelpDir, { recursive: true });
      await mkdir(projectOnlyDir, { recursive: true });
      await mkdir(userHelpDir, { recursive: true });
      await mkdir(userOnlyDir, { recursive: true });

      await writeFile(join(projectHelpDir, "SKILL.md"), "# project help\n");
      await writeFile(join(projectOnlyDir, "SKILL.md"), "# project only\n");
      await writeFile(join(userHelpDir, "SKILL.md"), "# user help\n");
      await writeFile(join(userOnlyDir, "SKILL.md"), "# user only\n");

      const skills = await listInstalledSkillDirectories(projectRoot);

      assert.deepEqual(
        skills.map((skill) => ({
          name: skill.name,
          scope: skill.scope,
        })),
        [
          { name: "help", scope: "project" },
          { name: "project-only", scope: "project" },
          { name: "user-only", scope: "user" },
        ],
      );
      assert.equal(skills[0]?.path, projectHelpDir);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
      await rm(codexHomeRoot, { recursive: true, force: true });
    }
  });
  it("detects overlapping legacy and canonical user skill roots including content mismatches", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "omcp-paths-home-"));
    const codexHomeRoot = join(homeRoot, ".copilot");
    const legacyRoot = join(homeRoot, ".agents", "skills");
    process.env.HOME = homeRoot;
    process.env.USERPROFILE = homeRoot;
    process.env.COPILOT_HOME = codexHomeRoot;

    try {
      const canonicalHelpDir = join(codexHomeRoot, "skills", "help");
      const canonicalPlanDir = join(codexHomeRoot, "skills", "plan");
      const legacyHelpDir = join(legacyRoot, "help");
      const legacyOnlyDir = join(legacyRoot, "legacy-only");

      await mkdir(canonicalHelpDir, { recursive: true });
      await mkdir(canonicalPlanDir, { recursive: true });
      await mkdir(legacyHelpDir, { recursive: true });
      await mkdir(legacyOnlyDir, { recursive: true });

      await writeFile(join(canonicalHelpDir, "SKILL.md"), "# canonical help\n");
      await writeFile(join(canonicalPlanDir, "SKILL.md"), "# canonical plan\n");
      await writeFile(join(legacyHelpDir, "SKILL.md"), "# legacy help\n");
      await writeFile(join(legacyOnlyDir, "SKILL.md"), "# legacy only\n");

      const overlap = await detectLegacySkillRootOverlap();

      assert.equal(overlap.canonicalExists, true);
      assert.equal(overlap.legacyExists, true);
      assert.equal(overlap.canonicalSkillCount, 2);
      assert.equal(overlap.legacySkillCount, 2);
      assert.deepEqual(overlap.overlappingSkillNames, ["help"]);
      assert.deepEqual(overlap.mismatchedSkillNames, ["help"]);
      assert.equal(overlap.sameResolvedTarget, false);
    } finally {
      await rm(homeRoot, { recursive: true, force: true });
    }
  });

  it("treats a legacy link to canonical skills as the same resolved target", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "omcp-paths-linked-home-"));
    const codexHomeRoot = join(homeRoot, ".copilot");
    const canonicalSkillsRoot = join(codexHomeRoot, "skills");
    const legacyParent = join(homeRoot, ".agents");
    const legacyRoot = join(legacyParent, "skills");
    process.env.HOME = homeRoot;
    process.env.USERPROFILE = homeRoot;
    process.env.COPILOT_HOME = codexHomeRoot;

    try {
      const canonicalHelpDir = join(canonicalSkillsRoot, "help");
      await mkdir(canonicalHelpDir, { recursive: true });
      await mkdir(legacyParent, { recursive: true });
      await writeFile(join(canonicalHelpDir, "SKILL.md"), "# canonical help\n");
      await symlink(
        canonicalSkillsRoot,
        legacyRoot,
        process.platform === "win32" ? "junction" : "dir",
      );

      const overlap = await detectLegacySkillRootOverlap();

      assert.equal(overlap.canonicalExists, true);
      assert.equal(overlap.legacyExists, true);
      assert.equal(overlap.canonicalSkillCount, 1);
      assert.equal(overlap.legacySkillCount, 1);
      assert.equal(overlap.sameResolvedTarget, true);
      assert.deepEqual(overlap.overlappingSkillNames, ["help"]);
      assert.deepEqual(overlap.mismatchedSkillNames, []);
    } finally {
      await rm(homeRoot, { recursive: true, force: true });
    }
  });
});

describe("omcpStateDir", () => {
  it("uses provided projectRoot", () => {
    assert.equal(omcpStateDir("/my/project"), join("/my/project", ".omcp", "state"));
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(omcpStateDir(), join(process.cwd(), ".omcp", "state"));
  });
});

describe("omcpProjectMemoryPath", () => {
  it("uses provided projectRoot", () => {
    assert.equal(
      omcpProjectMemoryPath("/my/project"),
      join("/my/project", ".omcp", "project-memory.json"),
    );
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(
      omcpProjectMemoryPath(),
      join(process.cwd(), ".omcp", "project-memory.json"),
    );
  });
});

describe("omcpNotepadPath", () => {
  it("uses provided projectRoot", () => {
    assert.equal(omcpNotepadPath("/my/project"), join("/my/project", ".omcp", "notepad.md"));
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(omcpNotepadPath(), join(process.cwd(), ".omcp", "notepad.md"));
  });
});

describe("omcpPlansDir", () => {
  it("uses provided projectRoot", () => {
    assert.equal(omcpPlansDir("/my/project"), join("/my/project", ".omcp", "plans"));
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(omcpPlansDir(), join(process.cwd(), ".omcp", "plans"));
  });
});

describe("omcpLogsDir", () => {
  it("uses provided projectRoot", () => {
    assert.equal(omcpLogsDir("/my/project"), join("/my/project", ".omcp", "logs"));
  });

  it("defaults to cwd when no projectRoot given", () => {
    assert.equal(omcpLogsDir(), join(process.cwd(), ".omcp", "logs"));
  });
});

describe("packageRoot", () => {
  it("resolves to a directory containing package.json", () => {
    const root = packageRoot();
    assert.equal(existsSync(join(root, "package.json")), true);
  });
});

describe("OMCP launcher path resolution", () => {
  const originalEntryPath = process.env[OMCP_ENTRY_PATH_ENV];
  const originalStartupCwd = process.env[OMCP_STARTUP_CWD_ENV];

  afterEach(() => {
    if (typeof originalEntryPath === "string") {
      process.env[OMCP_ENTRY_PATH_ENV] = originalEntryPath;
    } else {
      delete process.env[OMCP_ENTRY_PATH_ENV];
    }
    if (typeof originalStartupCwd === "string") {
      process.env[OMCP_STARTUP_CWD_ENV] = originalStartupCwd;
    } else {
      delete process.env[OMCP_STARTUP_CWD_ENV];
    }
  });

  it("resolves relative launcher paths against the recorded startup cwd", async () => {
    const startupCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-start-"));
    const laterCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-later-"));
    try {
      const launcherDir = join(startupCwd, "dist", "cli");
      const launcherPath = join(launcherDir, "omcp.js");
      await mkdir(launcherDir, { recursive: true });
      await writeFile(launcherPath, "#!/usr/bin/env node\n", "utf-8");

      const resolved = resolveOmcpEntryPath({
        argv1: "dist/cli/omcp.js",
        cwd: laterCwd,
        env: {
          ...process.env,
          [OMCP_STARTUP_CWD_ENV]: startupCwd,
        },
      });

      assert.equal(resolved, launcherPath);
    } finally {
      await rm(startupCwd, { recursive: true, force: true });
      await rm(laterCwd, { recursive: true, force: true });
    }
  });

  it("records launcher context once so later cwd changes keep the absolute entry path", async () => {
    const startupCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-record-"));
    try {
      const launcherDir = join(startupCwd, "dist", "cli");
      const launcherPath = join(launcherDir, "omcp.js");
      await mkdir(launcherDir, { recursive: true });
      await writeFile(launcherPath, "#!/usr/bin/env node\n", "utf-8");

      delete process.env[OMCP_ENTRY_PATH_ENV];
      delete process.env[OMCP_STARTUP_CWD_ENV];
      rememberOmcpLaunchContext({
        argv1: "dist/cli/omcp.js",
        cwd: startupCwd,
        env: process.env,
      });

      assert.equal(process.env[OMCP_STARTUP_CWD_ENV], startupCwd);
      assert.equal(process.env[OMCP_ENTRY_PATH_ENV], launcherPath);
    } finally {
      await rm(startupCwd, { recursive: true, force: true });
    }
  });

  it("falls back to the packaged CLI entry when argv1 points at a non-CLI script", async () => {
    const startupCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-cli-fallback-start-"));
    const packageRootDir = await mkdtemp(join(tmpdir(), "omcp-launcher-cli-fallback-root-"));
    try {
      const hookDir = join(startupCwd, "dist", "scripts");
      const hookPath = join(hookDir, "codex-native-hook.js");
      const cliDir = join(packageRootDir, "dist", "cli");
      const cliPath = join(cliDir, "omcp.js");
      await mkdir(hookDir, { recursive: true });
      await mkdir(cliDir, { recursive: true });
      await writeFile(hookPath, "#!/usr/bin/env node\n", "utf-8");
      await writeFile(cliPath, "#!/usr/bin/env node\n", "utf-8");

      const resolved = resolveOmcpCliEntryPath({
        argv1: "dist/scripts/codex-native-hook.js",
        cwd: startupCwd,
        env: {
          ...process.env,
          [OMCP_STARTUP_CWD_ENV]: startupCwd,
        },
        packageRootDir,
      });

      assert.equal(resolved, cliPath);
    } finally {
      await rm(startupCwd, { recursive: true, force: true });
      await rm(packageRootDir, { recursive: true, force: true });
    }
  });

  it("keeps the resolved path when argv1 already points at the CLI entry", async () => {
    const startupCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-cli-direct-start-"));
    try {
      const cliDir = join(startupCwd, "dist", "cli");
      const cliPath = join(cliDir, "omcp.js");
      await mkdir(cliDir, { recursive: true });
      await writeFile(cliPath, "#!/usr/bin/env node\n", "utf-8");

      const resolved = resolveOmcpCliEntryPath({
        argv1: "dist/cli/omcp.js",
        cwd: startupCwd,
        env: {
          ...process.env,
          [OMCP_STARTUP_CWD_ENV]: startupCwd,
        },
      });

      assert.equal(resolved, cliPath);
    } finally {
      await rm(startupCwd, { recursive: true, force: true });
    }
  });

  it("falls back from a non-OMCP host binary to the packaged CLI entry", async () => {
    const startupCwd = await mkdtemp(join(tmpdir(), "omcp-launcher-cli-host-start-"));
    const packageRootDir = await mkdtemp(join(tmpdir(), "omcp-launcher-cli-host-root-"));
    try {
      const hostPath = join(startupCwd, "codex-host");
      const cliDir = join(packageRootDir, "dist", "cli");
      const cliPath = join(cliDir, "omcp.js");
      await writeFile(hostPath, "#!/usr/bin/env node\n", "utf-8");
      await mkdir(cliDir, { recursive: true });
      await writeFile(cliPath, "#!/usr/bin/env node\n", "utf-8");

      const resolved = resolveOmcpCliEntryPath({
        argv1: hostPath,
        cwd: startupCwd,
        env: {
          ...process.env,
          [OMCP_STARTUP_CWD_ENV]: startupCwd,
        },
        packageRootDir,
      });

      assert.equal(resolved, cliPath);
    } finally {
      await rm(startupCwd, { recursive: true, force: true });
      await rm(packageRootDir, { recursive: true, force: true });
    }
  });

});
