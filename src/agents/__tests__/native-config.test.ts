import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { AgentDefinition } from "../definitions.js";
import {
  generateAgentMarkdown,
  installNativeAgentConfigs,
} from "../native-config.js";

const originalStandardModel = process.env.OMCP_DEFAULT_STANDARD_MODEL;

beforeEach(() => {
  process.env.OMCP_DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
});

afterEach(() => {
  if (typeof originalStandardModel === "string") {
    process.env.OMCP_DEFAULT_STANDARD_MODEL = originalStandardModel;
  } else {
    delete process.env.OMCP_DEFAULT_STANDARD_MODEL;
  }
});

describe("agents/native-config", () => {
  it("generates markdown with YAML frontmatter and stripped body frontmatter", () => {
    const agent: AgentDefinition = {
      name: "executor",
      description: "Code implementation",
      reasoningEffort: "medium",
      posture: "deep-worker",
      modelClass: "standard",
      routingRole: "executor",
      tools: "execution",
      category: "build",
    };

    const prompt = `---\ntitle: demo\n---\n\nInstruction line\n\"\"\"safe\"\"\"`;
    const md = generateAgentMarkdown(agent, prompt);

    assert.match(md, /^---\n/);
    assert.match(md, /\nname: 'executor'\n/);
    assert.match(md, /\nmodel: 'gpt-5\.4'\n/);
    assert.match(md, /\ndescription: 'Code implementation'\n/);
    // frontmatter should close before body
    assert.match(md, /\n---\nInstruction line/);
    assert.ok(!md.includes("title: demo"));
    assert.ok(md.includes("Instruction line"));
    assert.ok(md.includes("You are operating in the deep-worker posture."));
    assert.ok(md.includes("- posture: deep-worker"));
    // triple quotes from body must be preserved verbatim
    assert.ok(md.includes('"""safe"""'));
  });

  it("applies exact-model mini guidance only for resolved gpt-5.4-mini standard roles", () => {
    const agent: AgentDefinition = {
      name: "debugger",
      description: "Root-cause analysis",
      reasoningEffort: "medium",
      posture: "deep-worker",
      modelClass: "standard",
      routingRole: "executor",
      tools: "analysis",
      category: "build",
    };

    const prompt = "Instruction line";
    const exactMiniMd = generateAgentMarkdown(agent, prompt, {
      env: { OMCP_DEFAULT_STANDARD_MODEL: "gpt-5.4-mini" } as NodeJS.ProcessEnv,
    });
    const frontierMd = generateAgentMarkdown(agent, prompt, {
      env: { OMCP_DEFAULT_STANDARD_MODEL: "gpt-5.4" } as NodeJS.ProcessEnv,
    });
    const tunedMd = generateAgentMarkdown(agent, prompt, {
      env: { OMCP_DEFAULT_STANDARD_MODEL: "gpt-5.4-mini-tuned" } as NodeJS.ProcessEnv,
    });

    assert.match(exactMiniMd, /exact gpt-5\.4-mini model/);
    assert.match(exactMiniMd, /strict execution order: inspect -> plan -> act -> verify/);
    assert.match(exactMiniMd, /resolved_model: gpt-5\.4-mini/);
    assert.doesNotMatch(frontierMd, /exact gpt-5\.4-mini model/);
    assert.doesNotMatch(tunedMd, /exact gpt-5\.4-mini model/);
  });

  it("installs only agents with prompt files and skips existing files without force", async () => {
    const root = await mkdtemp(join(tmpdir(), "omcp-native-config-"));
    const promptsDir = join(root, "prompts");
    const outDir = join(root, "agents-out");

    try {
      await mkdir(promptsDir, { recursive: true });
      await writeFile(join(promptsDir, "executor.md"), "executor prompt");
      await writeFile(join(promptsDir, "planner.md"), "planner prompt");

      const created = await installNativeAgentConfigs(root, {
        agentsDir: outDir,
      });
      assert.equal(created, 2);
      assert.equal(existsSync(join(outDir, "executor.md")), true);
      assert.equal(existsSync(join(outDir, "planner.md")), true);

      const executorMd = await readFile(
        join(outDir, "executor.md"),
        "utf8",
      );
      assert.match(executorMd, /^---\n/);
      assert.match(executorMd, /\nmodel: 'gpt-5\.4'\n/);
      assert.match(executorMd, /- resolved_model: gpt-5\.4/);

      const skipped = await installNativeAgentConfigs(root, {
        agentsDir: outDir,
      });
      assert.equal(skipped, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps standard agents off a custom gpt-5.2 root model", async () => {
    const root = await mkdtemp(join(tmpdir(), "omcp-native-config-root-model-"));
    const copilotHome = join(root, ".copilot");
    const promptsDir = join(root, "prompts");
    const outDir = join(copilotHome, "agents");
    const previousCodexHome = process.env.COPILOT_HOME;

    try {
      delete process.env.OMCP_DEFAULT_STANDARD_MODEL;
      process.env.COPILOT_HOME = copilotHome;
      await mkdir(promptsDir, { recursive: true });
      await mkdir(copilotHome, { recursive: true });
      await writeFile(join(copilotHome, "config.toml"), 'model = "gpt-5.2"\n');
      await writeFile(join(promptsDir, "debugger.md"), "debugger prompt");

      await installNativeAgentConfigs(root, { agentsDir: outDir });
      const debuggerMd = await readFile(join(outDir, "debugger.md"), "utf8");
      assert.match(debuggerMd, /\nmodel: 'gpt-5\.4-mini'\n/);
      assert.doesNotMatch(debuggerMd, /\nmodel: 'gpt-5\.2'\n/);
    } finally {
      if (typeof previousCodexHome === "string") process.env.COPILOT_HOME = previousCodexHome;
      else delete process.env.COPILOT_HOME;
      process.env.OMCP_DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps executor on the frontier lane so an explicit gpt-5.2 root model still applies there", async () => {
    const root = await mkdtemp(join(tmpdir(), "omcp-native-config-executor-model-"));
    const copilotHome = join(root, ".copilot");
    const promptsDir = join(root, "prompts");
    const outDir = join(copilotHome, "agents");
    const previousCodexHome = process.env.COPILOT_HOME;

    try {
      delete process.env.OMCP_DEFAULT_STANDARD_MODEL;
      process.env.COPILOT_HOME = copilotHome;
      await mkdir(promptsDir, { recursive: true });
      await mkdir(copilotHome, { recursive: true });
      await writeFile(join(copilotHome, "config.toml"), 'model = "gpt-5.2"\n');
      await writeFile(join(promptsDir, "executor.md"), "executor prompt");

      await installNativeAgentConfigs(root, { agentsDir: outDir });
      const executorMd = await readFile(join(outDir, "executor.md"), "utf8");
      assert.match(executorMd, /\nmodel: 'gpt-5\.2'\n/);
    } finally {
      if (typeof previousCodexHome === "string") process.env.COPILOT_HOME = previousCodexHome;
      else delete process.env.COPILOT_HOME;
      process.env.OMCP_DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
      await rm(root, { recursive: true, force: true });
    }
  });
});
