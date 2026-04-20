/**
 * Model Configuration
 *
 * Reads per-mode model overrides and default-env overrides from .omcp-config.json.
 *
 * Config format:
 * {
 *   "env": {
 *     "OMCP_DEFAULT_FRONTIER_MODEL": "your-frontier-model",
 *     "OMCP_DEFAULT_STANDARD_MODEL": "your-standard-model",
 *     "OMCP_DEFAULT_SPARK_MODEL": "your-spark-model"
 *   },
 *   "models": {
 *     "default": "o4-mini",
 *     "team": "gpt-4.1"
 *   }
 * }
 *
 * Resolution: mode-specific > "default" key > OMCP_DEFAULT_FRONTIER_MODEL > DEFAULT_FRONTIER_MODEL
 */

import { parse as parseToml } from '@iarna/toml';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { copilotConfigPath, copilotHome } from '../utils/paths.js';

export interface ModelsConfig {
  [mode: string]: string | undefined;
}

export interface OmcpConfigEnv {
  [key: string]: string | undefined;
}

interface OmcpConfigFile {
  env?: OmcpConfigEnv;
  models?: ModelsConfig;
}

interface CodexConfigFile {
  model_provider?: unknown;
  model_providers?: Record<string, unknown>;
}

export const OMCP_DEFAULT_FRONTIER_MODEL_ENV = 'OMCP_DEFAULT_FRONTIER_MODEL';
export const OMCP_DEFAULT_STANDARD_MODEL_ENV = 'OMCP_DEFAULT_STANDARD_MODEL';
export const OMCP_DEFAULT_SPARK_MODEL_ENV = 'OMCP_DEFAULT_SPARK_MODEL';
export const OMCP_SPARK_MODEL_ENV = 'OMCP_SPARK_MODEL';

function readOmcpConfigFile(copilotHomeOverride?: string): OmcpConfigFile | null {
  const configPath = join(copilotHomeOverride || copilotHome(), '.omcp-config.json');
  if (!existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as OmcpConfigFile;
  } catch {
    return null;
  }
}

function readCodexConfigFile(copilotHomeOverride?: string): CodexConfigFile | null {
  const configPath = copilotHomeOverride
    ? join(copilotHomeOverride, 'config.toml')
    : copilotConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    const raw = parseToml(readFileSync(configPath, 'utf-8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as CodexConfigFile;
  } catch {
    return null;
  }
}

function readModelsBlock(copilotHomeOverride?: string): ModelsConfig | null {
  const config = readOmcpConfigFile(copilotHomeOverride);
  if (!config) return null;
  if (config.models && typeof config.models === 'object' && !Array.isArray(config.models)) {
    return config.models;
  }
  return null;
}

export const DEFAULT_FRONTIER_MODEL = 'gpt-5.4';
export const DEFAULT_STANDARD_MODEL = 'gpt-5.4-mini';
export const DEFAULT_SPARK_MODEL = 'gpt-5.3-codex-spark';

function normalizeConfiguredValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readConfigEnvValue(key: string, copilotHomeOverride?: string): string | undefined {
  const config = readOmcpConfigFile(copilotHomeOverride);
  if (!config || !config.env || typeof config.env !== 'object' || Array.isArray(config.env)) {
    return undefined;
  }
  return normalizeConfiguredValue(config.env[key]);
}

function readTeamLowComplexityOverride(copilotHomeOverride?: string): string | undefined {
  const models = readModelsBlock(copilotHomeOverride);
  if (!models) return undefined;
  for (const key of TEAM_LOW_COMPLEXITY_MODEL_KEYS) {
    const value = normalizeConfiguredValue(models[key]);
    if (value) return value;
  }
  return undefined;
}

export function readConfiguredEnvOverrides(copilotHomeOverride?: string): NodeJS.ProcessEnv {
  const config = readOmcpConfigFile(copilotHomeOverride);
  if (!config || !config.env || typeof config.env !== 'object' || Array.isArray(config.env)) {
    return {};
  }

  const resolved: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(config.env)) {
    const normalized = normalizeConfiguredValue(value);
    if (normalized) resolved[key] = normalized;
  }
  return resolved;
}

export function readActiveProviderEnvOverrides(
  env: NodeJS.ProcessEnv = process.env,
  copilotHomeOverride?: string,
): NodeJS.ProcessEnv {
  const config = readCodexConfigFile(copilotHomeOverride);
  if (!config) return {};

  const activeProvider = normalizeConfiguredValue(config.model_provider);
  if (!activeProvider) return {};

  const providers = config.model_providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    return {};
  }

  const providerConfig = providers[activeProvider];
  if (!providerConfig || typeof providerConfig !== 'object' || Array.isArray(providerConfig)) {
    return {};
  }

  const envKey = normalizeConfiguredValue((providerConfig as Record<string, unknown>).env_key);
  if (!envKey) return {};

  const envValue = normalizeConfiguredValue(env[envKey]);
  return envValue ? { [envKey]: envValue } : {};
}

export function getEnvConfiguredMainDefaultModel(
  env: NodeJS.ProcessEnv = process.env,
  copilotHomeOverride?: string,
): string | undefined {
  return normalizeConfiguredValue(env[OMCP_DEFAULT_FRONTIER_MODEL_ENV])
    ?? readConfigEnvValue(OMCP_DEFAULT_FRONTIER_MODEL_ENV, copilotHomeOverride);
}

export function getEnvConfiguredStandardDefaultModel(
  env: NodeJS.ProcessEnv = process.env,
  copilotHomeOverride?: string,
): string | undefined {
  return normalizeConfiguredValue(env[OMCP_DEFAULT_STANDARD_MODEL_ENV])
    ?? readConfigEnvValue(OMCP_DEFAULT_STANDARD_MODEL_ENV, copilotHomeOverride);
}

export function getEnvConfiguredSparkDefaultModel(
  env: NodeJS.ProcessEnv = process.env,
  copilotHomeOverride?: string,
): string | undefined {
  return normalizeConfiguredValue(env[OMCP_DEFAULT_SPARK_MODEL_ENV])
    ?? normalizeConfiguredValue(env[OMCP_SPARK_MODEL_ENV])
    ?? readConfigEnvValue(OMCP_DEFAULT_SPARK_MODEL_ENV, copilotHomeOverride)
    ?? readConfigEnvValue(OMCP_SPARK_MODEL_ENV, copilotHomeOverride);
}

/**
 * Get the envvar-backed main/default model.
 * Resolution: OMCP_DEFAULT_FRONTIER_MODEL > DEFAULT_FRONTIER_MODEL
 */
export function getMainDefaultModel(copilotHomeOverride?: string): string {
  return getEnvConfiguredMainDefaultModel(process.env, copilotHomeOverride)
    ?? DEFAULT_FRONTIER_MODEL;
}

/**
 * Get the envvar-backed standard/default subagent model.
 * Resolution: OMCP_DEFAULT_STANDARD_MODEL > DEFAULT_STANDARD_MODEL
 */
export function getStandardDefaultModel(copilotHomeOverride?: string): string {
  return getEnvConfiguredStandardDefaultModel(process.env, copilotHomeOverride)
    ?? DEFAULT_STANDARD_MODEL;
}

/**
 * Get the configured model for a specific mode.
 * Resolution: mode-specific override > "default" key > OMCP_DEFAULT_FRONTIER_MODEL > DEFAULT_FRONTIER_MODEL
 */
export function getModelForMode(mode: string, copilotHomeOverride?: string): string {
  const models = readModelsBlock(copilotHomeOverride);
  const modeValue = normalizeConfiguredValue(models?.[mode]);
  if (modeValue) return modeValue;

  const defaultValue = normalizeConfiguredValue(models?.default);
  if (defaultValue) return defaultValue;

  return getMainDefaultModel(copilotHomeOverride);
}

const TEAM_LOW_COMPLEXITY_MODEL_KEYS = [
  'team_low_complexity',
  'team-low-complexity',
  'teamLowComplexity',
];

/**
 * Get the envvar-backed spark/low-complexity default model.
 * Resolution: OMCP_DEFAULT_SPARK_MODEL > OMCP_SPARK_MODEL > explicit low-complexity key(s) > DEFAULT_SPARK_MODEL
 */
export function getSparkDefaultModel(copilotHomeOverride?: string): string {
  return getEnvConfiguredSparkDefaultModel(process.env, copilotHomeOverride)
    ?? readTeamLowComplexityOverride(copilotHomeOverride)
    ?? DEFAULT_SPARK_MODEL;
}

/**
 * Get the low-complexity team worker model.
 * Resolution: explicit low-complexity key(s) > OMCP_DEFAULT_SPARK_MODEL > OMCP_SPARK_MODEL > DEFAULT_SPARK_MODEL
 */
export function getTeamLowComplexityModel(copilotHomeOverride?: string): string {
  return readTeamLowComplexityOverride(copilotHomeOverride) ?? getSparkDefaultModel(copilotHomeOverride);
}
