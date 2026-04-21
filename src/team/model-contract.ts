import { getAgent } from '../agents/definitions.js';
import {
  DEFAULT_SPARK_MODEL,
  getMainDefaultModel,
  getSparkDefaultModel,
  getStandardDefaultModel,
} from '../config/models.js';

const MADMAX_FLAG = '--madmax';
const COPILOT_BYPASS_FLAG = '--allow-all-tools';
const MODEL_FLAG = '--model';
const CONFIG_FLAG = '-c';
const REASONING_KEY = 'model_reasoning_effort';
const COPILOT_REASONING_FLAG = '--reasoning-effort';

const LOW_COMPLEXITY_AGENT_TYPES = new Set([
  'explore',
  'explorer',
  'style-reviewer',
]);

// Canonical default only; effective low-complexity resolution flows through resolveTeamLowComplexityDefaultModel().
export const TEAM_LOW_COMPLEXITY_DEFAULT_MODEL = DEFAULT_SPARK_MODEL;
export type TeamReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface ParsedTeamWorkerLaunchArgs {
  passthrough: string[];
  wantsBypass: boolean;
  reasoningOverride: TeamReasoningEffort | null;
  modelOverride: string | null;
}

export interface ResolveTeamWorkerLaunchArgsOptions {
  existingRaw?: string;
  inheritedArgs?: string[];
  fallbackModel?: string;
  preferredReasoning?: TeamReasoningEffort;
}


function isReasoningOverride(value: string): boolean {
  return new RegExp(`^${REASONING_KEY}\\s*=`).test(value.trim());
}

function extractReasoningLevelFromCodexPair(value: string): TeamReasoningEffort | undefined {
  // Accept `model_reasoning_effort="medium"` or `model_reasoning_effort=medium`.
  const match = value.trim().match(/^model_reasoning_effort\s*=\s*"?([A-Za-z]+)"?\s*$/);
  if (!match) return undefined;
  return normalizeOptionalReasoning(match[1]);
}

function isValidModelValue(value: string): boolean {
  return value.trim().length > 0 && !value.startsWith('-');
}

function normalizeOptionalModel(model?: string | null): string | undefined {
  if (typeof model !== 'string') return undefined;
  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalReasoning(reasoning?: TeamReasoningEffort | string | null): TeamReasoningEffort | undefined {
  if (typeof reasoning !== 'string') return undefined;
  const normalized = reasoning.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'xhigh') {
    return normalized;
  }
  return undefined;
}

export function splitWorkerLaunchArgs(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseTeamWorkerLaunchArgs(args: string[]): ParsedTeamWorkerLaunchArgs {
  const passthrough: string[] = [];
  let wantsBypass = false;
  let reasoningOverride: TeamReasoningEffort | null = null;
  let modelOverride: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === COPILOT_BYPASS_FLAG || arg === MADMAX_FLAG) {
      wantsBypass = true;
      continue;
    }

    if (arg === MODEL_FLAG) {
      const maybeValue = args[i + 1];
      if (typeof maybeValue === 'string' && isValidModelValue(maybeValue)) {
        modelOverride = maybeValue.trim();
        i += 1;
      }
      // Orphan --model with no valid value is silently dropped (never passthrough)
      continue;
    }

    if (arg.startsWith(`${MODEL_FLAG}=`)) {
      const inlineValue = arg.slice(`${MODEL_FLAG}=`.length).trim();
      if (isValidModelValue(inlineValue)) {
        modelOverride = inlineValue;
      }
      // --model= with empty/invalid value is silently dropped (never passthrough)
      continue;
    }

    // Copilot-native reasoning flag: --reasoning-effort <level> or --effort <level>.
    if (arg === COPILOT_REASONING_FLAG || arg === '--effort') {
      const maybeValue = args[i + 1];
      const level = typeof maybeValue === 'string' ? normalizeOptionalReasoning(maybeValue) : undefined;
      if (level) {
        reasoningOverride = level;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith(`${COPILOT_REASONING_FLAG}=`) || arg.startsWith('--effort=')) {
      const inline = arg.slice(arg.indexOf('=') + 1);
      const level = normalizeOptionalReasoning(inline);
      if (level) reasoningOverride = level;
      continue;
    }

    // Legacy Codex form: `-c model_reasoning_effort="<level>"`. Accept for
    // backwards compatibility with any persisted team state, but emit the
    // Copilot form on serialization.
    if (arg === CONFIG_FLAG) {
      const maybeValue = args[i + 1];
      if (typeof maybeValue === 'string' && isReasoningOverride(maybeValue)) {
        const level = extractReasoningLevelFromCodexPair(maybeValue);
        if (level) reasoningOverride = level;
        i += 1;
        continue;
      }
    }

    passthrough.push(arg);
  }

  return {
    passthrough,
    wantsBypass,
    reasoningOverride,
    modelOverride,
  };
}

export function collectInheritableTeamWorkerArgs(codexArgs: string[]): string[] {
  const parsed = parseTeamWorkerLaunchArgs(codexArgs);

  const inherited: string[] = [];
  if (parsed.wantsBypass) inherited.push(COPILOT_BYPASS_FLAG);
  if (parsed.reasoningOverride) inherited.push(COPILOT_REASONING_FLAG, parsed.reasoningOverride);
  if (parsed.modelOverride) inherited.push(MODEL_FLAG, parsed.modelOverride);
  return inherited;
}

export function normalizeTeamWorkerLaunchArgs(
  args: string[],
  preferredModel?: string,
  preferredReasoning?: TeamReasoningEffort,
): string[] {
  const parsed = parseTeamWorkerLaunchArgs(args);
  const normalized = [...parsed.passthrough];

  if (parsed.wantsBypass) normalized.push(COPILOT_BYPASS_FLAG);

  const selectedReasoning = parsed.reasoningOverride ?? normalizeOptionalReasoning(preferredReasoning);
  if (selectedReasoning) normalized.push(COPILOT_REASONING_FLAG, selectedReasoning);

  const selectedModel = normalizeOptionalModel(preferredModel) ?? normalizeOptionalModel(parsed.modelOverride);
  if (selectedModel) normalized.push(MODEL_FLAG, selectedModel);

  return normalized;
}

export function resolveTeamWorkerLaunchArgs(options: ResolveTeamWorkerLaunchArgsOptions): string[] {
  const envArgs = splitWorkerLaunchArgs(options.existingRaw);
  const inheritedArgs = options.inheritedArgs ?? [];
  const allArgs = [...envArgs, ...inheritedArgs];

  const envModel = normalizeOptionalModel(parseTeamWorkerLaunchArgs(envArgs).modelOverride);
  const inheritedModel = normalizeOptionalModel(parseTeamWorkerLaunchArgs(inheritedArgs).modelOverride);
  const fallbackModel = normalizeOptionalModel(options.fallbackModel);
  const selectedModel = envModel ?? inheritedModel ?? fallbackModel;
  return normalizeTeamWorkerLaunchArgs(allArgs, selectedModel, options.preferredReasoning);
}

export function resolveAgentReasoningEffort(agentType?: string): TeamReasoningEffort | undefined {
  if (typeof agentType !== 'string' || agentType.trim() === '') return undefined;
  return normalizeOptionalReasoning(getAgent(agentType)?.reasoningEffort);
}

export function resolveAgentDefaultModel(
  agentType?: string,
  copilotHomeOverride?: string,
): string | undefined {
  if (typeof agentType !== 'string' || agentType.trim() === '') return undefined;
  const normalized = agentType.trim().toLowerCase();
  if (normalized === '') return undefined;
  if (normalized.endsWith('-low')) return resolveTeamLowComplexityDefaultModel(copilotHomeOverride);
  if (normalized === 'executor') return getMainDefaultModel(copilotHomeOverride);

  switch (getAgent(normalized)?.modelClass) {
    case 'fast':
      return resolveTeamLowComplexityDefaultModel(copilotHomeOverride);
    case 'frontier':
      return getMainDefaultModel(copilotHomeOverride);
    case 'standard':
      return getStandardDefaultModel(copilotHomeOverride);
    default:
      return undefined;
  }
}

export function isLowComplexityAgentType(agentType?: string): boolean {
  if (!agentType) return false;
  const normalized = agentType.trim().toLowerCase();
  if (normalized === '') return false;
  if (normalized.endsWith('-low')) return true;
  return LOW_COMPLEXITY_AGENT_TYPES.has(normalized);
}

export function resolveTeamLowComplexityDefaultModel(copilotHomeOverride?: string): string {
  return getSparkDefaultModel(copilotHomeOverride);
}
