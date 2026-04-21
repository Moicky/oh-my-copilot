/**
 * Native agent config generators for Copilot CLI.
 *
 * Copilot CLI loads custom agents from markdown files with YAML frontmatter
 * under ~/.copilot/agents/*.md (or ./.copilot/agents/*.md for project scope).
 * The frontmatter holds `name`, `description`, and `model`; the body is the
 * agent's system prompt.
 *
 * NOTE: This module previously emitted Codex-compatible .toml files with
 * fields like `developer_instructions` and `model_reasoning_effort`. Copilot
 * ignores that schema entirely — see fix/copilot-agents-md migration.
 */

import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { AGENT_DEFINITIONS, AgentDefinition } from "./definitions.js";
import {
  getEnvConfiguredStandardDefaultModel,
  getMainDefaultModel,
  getSparkDefaultModel,
  getStandardDefaultModel,
} from "../config/models.js";
import { getRootModelName } from "../config/generator.js";
import { copilotAgentsDir } from "../utils/paths.js";

export const EXACT_GPT_5_4_MINI_MODEL = "gpt-5.4-mini";

const POSTURE_OVERLAYS: Record<AgentDefinition["posture"], string> = {
  "frontier-orchestrator": [
    "<posture_overlay>",
    "",
    "You are operating in the frontier-orchestrator posture.",
    "- Prioritize intent classification before implementation.",
    "- Default to delegation and orchestration when specialists exist.",
    "- Treat the first decision as a routing problem: research vs planning vs implementation vs verification.",
    "- Challenge flawed user assumptions concisely before execution when the design is likely to cause avoidable problems.",
    "- Preserve explicit executor handoff boundaries: do not absorb deep implementation work when a specialized executor is more appropriate.",
    "",
    "</posture_overlay>",
  ].join("\n"),
  "deep-worker": [
    "<posture_overlay>",
    "",
    "You are operating in the deep-worker posture.",
    "- Once the task is clearly implementation-oriented, bias toward direct execution and end-to-end completion.",
    "- Explore first, then implement minimal changes that match existing patterns.",
    "- Keep verification strict: diagnostics, tests, and build evidence are mandatory before claiming completion.",
    "- Escalate only after materially different approaches fail or when architecture tradeoffs exceed local implementation scope.",
    "",
    "</posture_overlay>",
  ].join("\n"),
  "fast-lane": [
    "<posture_overlay>",
    "",
    "You are operating in the fast-lane posture.",
    "- Optimize for fast triage, search, lightweight synthesis, and narrow routing decisions.",
    "- Do not start deep implementation unless the task is tightly bounded and obvious.",
    "- If the task expands beyond quick classification or lightweight execution, escalate to a frontier-orchestrator or deep-worker role.",
    "- Keep responses quality-first, scope-aware, and conservative under ambiguity; avoid empty verbosity and reflexive tool escalation.",
    "",
    "</posture_overlay>",
  ].join("\n"),
};

const MODEL_CLASS_OVERLAYS: Record<AgentDefinition["modelClass"], string> = {
  frontier: [
    "<model_class_guidance>",
    "",
    "This role is tuned for frontier-class models.",
    "- Use the model's steerability for coordination, tradeoff reasoning, and precise delegation.",
    "- Favor clean routing decisions over impulsive implementation.",
    "",
    "</model_class_guidance>",
  ].join("\n"),
  standard: [
    "<model_class_guidance>",
    "",
    "This role is tuned for standard-capability models.",
    "- Balance autonomy with clear boundaries.",
    "- Prefer explicit verification and narrow scope control over speculative reasoning.",
    "",
    "</model_class_guidance>",
  ].join("\n"),
  fast: [
    "<model_class_guidance>",
    "",
    "This role is tuned for fast/low-latency models.",
    "- Prefer quick search, synthesis, and routing over prolonged reasoning.",
    "- Escalate rather than bluff when deeper work is required.",
    "",
    "</model_class_guidance>",
  ].join("\n"),
};

const EXACT_MINI_MODEL_OVERLAY = [
  "<exact_model_guidance>",
  "",
  `This role is executing under the exact ${EXACT_GPT_5_4_MINI_MODEL} model.`,
  "- Use a strict execution order: inspect -> plan -> act -> verify.",
  "- Treat completion criteria as explicit: only report done after the requested work is implemented and fresh verification passes.",
  "- If requirements are ambiguous or a blocker appears, state the blocker plainly and stop guessing until the missing decision is resolved.",
  "- Do not bluff, pad, or invent results; report missing evidence and incomplete work honestly.",
  "",
  "</exact_model_guidance>",
].join("\n");

export interface GeneratedNativeAgentConfig {
  name: string;
  description: string;
  /**
   * Body of the agent markdown file — used verbatim as the system prompt.
   * Previously this was `developer_instructions` when OMCP targeted Codex.
   */
  systemPrompt?: string;
  model?: string;
  /**
   * Retained for internal metadata; Copilot agent frontmatter does not
   * currently expose a per-agent reasoning effort knob, so this is appended to
   * the body as metadata rather than written as a frontmatter key.
   */
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
}

interface AgentModelResolutionOptions {
  copilotHomeOverride?: string;
  configTomlContent?: string;
  env?: NodeJS.ProcessEnv;
}

interface RoleInstructionMetadata {
  name: string;
  posture: AgentDefinition["posture"];
  modelClass: AgentDefinition["modelClass"];
  routingRole: AgentDefinition["routingRole"];
}

function readConfigTomlContent(
  copilotHomeOverride?: string,
  provided?: string,
): string {
  if (typeof provided === "string") return provided;
  const configPath = join(copilotHomeOverride ?? process.env.COPILOT_HOME ?? "", "config.toml");
  if (copilotHomeOverride && existsSync(configPath)) {
    return readFileSync(configPath, "utf-8");
  }
  return "";
}

function resolveFrontierModel(options: AgentModelResolutionOptions): string {
  const configTomlContent = readConfigTomlContent(
    options.copilotHomeOverride,
    options.configTomlContent,
  );
  return getRootModelName(configTomlContent)
    ?? getMainDefaultModel(options.copilotHomeOverride);
}

function resolveStandardModel(options: AgentModelResolutionOptions): string {
  const explicitStandardModel = getEnvConfiguredStandardDefaultModel(
    options.env ?? process.env,
    options.copilotHomeOverride,
  );

  if (explicitStandardModel) return explicitStandardModel;
  return getStandardDefaultModel(options.copilotHomeOverride);
}

function resolveAgentModel(
  agent: AgentDefinition,
  options: AgentModelResolutionOptions = {},
): string {
  if (agent.name === "executor") {
    return resolveFrontierModel(options);
  }

  switch (agent.modelClass) {
    case "frontier":
      return resolveFrontierModel(options);
    case "fast":
      return getSparkDefaultModel(options.copilotHomeOverride);
    case "standard":
    default:
      return resolveStandardModel(options);
  }
}

function isExactMiniModel(resolvedModel?: string | null): boolean {
  return resolvedModel?.trim() === EXACT_GPT_5_4_MINI_MODEL;
}

export function composeRoleInstructions(
  promptContent: string,
  metadata: RoleInstructionMetadata | null,
  resolvedModel?: string,
): string {
  const instructions = stripFrontmatter(promptContent);
  const parts = [instructions];

  if (metadata) {
    parts.push(
      "",
      POSTURE_OVERLAYS[metadata.posture],
      "",
      MODEL_CLASS_OVERLAYS[metadata.modelClass],
    );
  }

  if (isExactMiniModel(resolvedModel)) {
    parts.push("", EXACT_MINI_MODEL_OVERLAY);
  }

  const metadataLines = [];
  if (metadata) {
    metadataLines.push(
      "## OMCP Agent Metadata",
      `- role: ${metadata.name}`,
      `- posture: ${metadata.posture}`,
      `- model_class: ${metadata.modelClass}`,
      `- routing_role: ${metadata.routingRole}`,
    );
  }
  if (resolvedModel) {
    if (metadataLines.length === 0) {
      metadataLines.push("## OMCP Agent Metadata");
    }
    metadataLines.push(`- resolved_model: ${resolvedModel}`);
  }
  if (metadataLines.length > 0) {
    parts.push("", ...metadataLines);
  }

  return parts.join("\n");
}

export function composeRoleInstructionsForRole(
  roleName: string,
  promptContent: string,
  resolvedModel?: string,
): string {
  const agent = AGENT_DEFINITIONS[roleName];
  return composeRoleInstructions(
    promptContent,
    agent
      ? {
          name: agent.name,
          posture: agent.posture,
          modelClass: agent.modelClass,
          routingRole: agent.routingRole,
        }
      : null,
    resolvedModel,
  );
}

/**
 * Strip YAML frontmatter (between --- markers) from markdown content.
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

/**
 * Escape a YAML 1.2 scalar safely — prefers a single-quoted string which only
 * needs single-quote doubling. Returns the fully quoted value.
 */
function quoteYamlScalar(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Render a description field. Short single-line values use a single-quoted
 * scalar. Multi-line content uses a YAML literal block (`|`) so the markdown
 * inside is preserved without escaping.
 */
function renderYamlDescription(description: string): string {
  const normalized = description.replace(/\r\n/g, "\n");
  if (!normalized.includes("\n")) {
    return `description: ${quoteYamlScalar(normalized)}`;
  }
  const indented = normalized
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : ""))
    .join("\n");
  return `description: |\n${indented}`;
}

export function generateStandaloneAgentMarkdown(
  config: GeneratedNativeAgentConfig,
): string {
  const frontmatter: string[] = [
    "---",
    `name: ${quoteYamlScalar(config.name)}`,
    renderYamlDescription(config.description),
  ];
  if (config.model) {
    frontmatter.push(`model: ${quoteYamlScalar(config.model)}`);
  }
  frontmatter.push("---", "");

  const body = (config.systemPrompt ?? "").trim();
  return `${frontmatter.join("\n")}${body}\n`;
}

/**
 * Generate markdown content for a prompt-backed OMCP role agent.
 */
export function generateAgentMarkdown(
  agent: AgentDefinition,
  promptContent: string,
  options: AgentModelResolutionOptions = {},
): string {
  const resolvedModel = resolveAgentModel(agent, options);
  return generateStandaloneAgentMarkdown({
    name: agent.name,
    description: agent.description,
    systemPrompt: composeRoleInstructions(promptContent, agent, resolvedModel),
    model: resolvedModel,
    reasoningEffort: agent.reasoningEffort,
  });
}

/**
 * Install prompt-backed native agent config .md files to ~/.copilot/agents/.
 * Returns the number of agent files written.
 */
export async function installNativeAgentConfigs(
  pkgRoot: string,
  options: {
    force?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    agentsDir?: string;
  } = {},
): Promise<number> {
  const {
    force = false,
    dryRun = false,
    verbose = false,
    agentsDir = copilotAgentsDir(),
  } = options;
  const copilotHomeOverride = join(agentsDir, "..");

  if (!dryRun) {
    await mkdir(agentsDir, { recursive: true });
  }

  let count = 0;

  for (const [name, agent] of Object.entries(AGENT_DEFINITIONS)) {
    const promptPath = join(pkgRoot, "prompts", `${name}.md`);
    if (!existsSync(promptPath)) {
      if (verbose) console.log(`  skip ${name} (no prompt file)`);
      continue;
    }

    const dst = join(agentsDir, `${name}.md`);
    if (!force && existsSync(dst)) {
      if (verbose) console.log(`  skip ${name} (already exists)`);
      continue;
    }

    const promptContent = await readFile(promptPath, "utf-8");
    const md = generateAgentMarkdown(agent, promptContent, { copilotHomeOverride });

    if (!dryRun) {
      await writeFile(dst, md);
    }
    if (verbose) console.log(`  ${name}.md`);
    count += 1;
  }

  return count;
}
