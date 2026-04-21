import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface UnifiedMcpRegistryServer {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  startupTimeoutSec?: number;
  approval_mode?: string;
}

export interface UnifiedMcpRegistryLoadResult {
  servers: UnifiedMcpRegistryServer[];
  sourcePath?: string;
  warnings: string[];
}

export interface ClaudeCodeMcpServerConfig {
  command: string;
  args: string[];
  enabled: boolean;
  approval_mode?: string;
}

export interface ClaudeCodeSettingsSyncPlan {
  content?: string;
  added: string[];
  unchanged: string[];
  warnings: string[];
}
interface LoadUnifiedMcpRegistryOptions {
  candidates?: string[];
  homeDir?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toClaudeCodeMcpServerConfig(
  server: UnifiedMcpRegistryServer,
): ClaudeCodeMcpServerConfig {
  return {
    command: server.command,
    args: [...server.args],
    enabled: server.enabled,
    ...(server.approval_mode !== undefined ? { approval_mode: server.approval_mode } : {}),
  };
}
function normalizeTimeout(
  value: unknown,
  name: string,
  warnings: string[],
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    warnings.push(`registry entry "${name}" has invalid timeout; ignoring timeout`);
    return undefined;
  }
  return Math.floor(value);
}

function normalizeApprovalMode(
  value: unknown,
  name: string,
  warnings: string[],
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    warnings.push(
      `registry entry "${name}" has non-string approval_mode; ignoring approval_mode`,
    );
    return undefined;
  }
  return value;
}

function normalizeEntry(
  name: string,
  value: unknown,
  warnings: string[],
): UnifiedMcpRegistryServer | null {
  if (!isRecord(value)) {
    warnings.push(`registry entry "${name}" is not an object; skipping`);
    return null;
  }

  const command = value.command;
  if (typeof command !== "string" || command.trim().length === 0) {
    warnings.push(`registry entry "${name}" is missing command; skipping`);
    return null;
  }

  const argsValue = value.args;
  if (
    argsValue !== undefined &&
    (!Array.isArray(argsValue) || argsValue.some((item) => typeof item !== "string"))
  ) {
    warnings.push(`registry entry "${name}" has non-string args; skipping`);
    return null;
  }

  const enabledValue = value.enabled;
  if (enabledValue !== undefined && typeof enabledValue !== "boolean") {
    warnings.push(`registry entry "${name}" has non-boolean enabled; skipping`);
    return null;
  }

  const timeoutCandidate =
    value.timeout ?? value.startup_timeout_sec ?? value.startupTimeoutSec;
  const approvalMode = normalizeApprovalMode(value.approval_mode, name, warnings);

  return {
    name,
    command,
    args: (argsValue as string[] | undefined) ?? [],
    enabled: enabledValue ?? true,
    startupTimeoutSec: normalizeTimeout(timeoutCandidate, name, warnings),
    ...(approvalMode !== undefined ? { approval_mode: approvalMode } : {}),
  };
}

export function getUnifiedMcpRegistryCandidates(homeDir = homedir()): string[] {
  return [join(homeDir, ".omcp", "mcp-registry.json")];
}

export function getLegacyUnifiedMcpRegistryCandidate(homeDir = homedir()): string {
  return join(homeDir, ".omc", "mcp-registry.json");
}

export async function loadUnifiedMcpRegistry(
  options: LoadUnifiedMcpRegistryOptions = {},
): Promise<UnifiedMcpRegistryLoadResult> {
  const candidates =
    options.candidates ?? getUnifiedMcpRegistryCandidates(options.homeDir);
  const sourcePath = candidates.find((candidate) => existsSync(candidate));
  if (!sourcePath) {
    return { servers: [], warnings: [] };
  }

  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(sourcePath, "utf-8"));
  } catch (error) {
    warnings.push(`failed to parse shared MCP registry at ${sourcePath}: ${String(error)}`);
    return { servers: [], sourcePath, warnings };
  }

  if (!isRecord(parsed)) {
    warnings.push(`shared MCP registry at ${sourcePath} must be a JSON object`);
    return { servers: [], sourcePath, warnings };
  }

  const servers: UnifiedMcpRegistryServer[] = [];
  for (const [name, value] of Object.entries(parsed)) {
    const normalized = normalizeEntry(name, value, warnings);
    if (!normalized) continue;
    servers.push(normalized);
  }

  return { servers, sourcePath, warnings };
}

export function planClaudeCodeMcpSettingsSync(
  existingContent: string,
  servers: UnifiedMcpRegistryServer[],
): ClaudeCodeSettingsSyncPlan {
  if (servers.length === 0) {
    return { added: [], unchanged: [], warnings: [] };
  }

  let parsed: unknown = {};
  const trimmed = existingContent.trim();
  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(existingContent);
    } catch (error) {
      return {
        added: [],
        unchanged: [],
        warnings: [`failed to parse Claude settings.json: ${String(error)}`],
      };
    }
  }

  if (!isRecord(parsed)) {
    return {
      added: [],
      unchanged: [],
      warnings: ["Claude settings.json must contain a JSON object"],
    };
  }

  const currentMcpServers = parsed.mcpServers;
  if (currentMcpServers !== undefined && !isRecord(currentMcpServers)) {
    return {
      added: [],
      unchanged: [],
      warnings: ['Claude settings.json field "mcpServers" must be an object'],
    };
  }

  const nextMcpServers: Record<string, unknown> = {
    ...(currentMcpServers ?? {}),
  };
  const added: string[] = [];
  const unchanged: string[] = [];

  for (const server of servers) {
    if (Object.hasOwn(nextMcpServers, server.name)) {
      unchanged.push(server.name);
      continue;
    }
    nextMcpServers[server.name] = toClaudeCodeMcpServerConfig(server);
    added.push(server.name);
  }

  if (added.length === 0) {
    return { added, unchanged, warnings: [] };
  }

  return {
    content: `${JSON.stringify(
      {
        ...parsed,
        mcpServers: nextMcpServers,
      },
      null,
      2,
    )}\n`,
    added,
    unchanged,
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Copilot CLI ~/.copilot/mcp-config.json support
//
// Copilot CLI does NOT read Codex's config.toml [mcp_servers.*] tables.
// It reads ~/.copilot/mcp-config.json with shape:
//   {
//     "mcpServers": {
//       "<name>": {
//         "type": "local" | "http" | "sse",
//         "command"?: string, "args"?: string[], "env"?: object,   // local
//         "url"?: string, "headers"?: object,                       // http/sse
//         "tools"?: "*" | string | string[]
//       }
//     }
//   }
//
// We track OMCP-owned entries under a top-level marker key so uninstall
// can remove only the servers we added.
// ---------------------------------------------------------------------------

/** Top-level marker in mcp-config.json that lists OMCP-managed server names. */
export const COPILOT_MCP_MANAGED_MARKER = "x-omcp-managed-servers";

/** Entry describing a server to register in copilot mcp-config.json. */
export interface CopilotMcpServerEntry {
  name: string;
  /** Local stdio server (command/args). */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Remote http/sse server. */
  url?: string;
  headers?: Record<string, string>;
  transport?: "stdio" | "http" | "sse";
  /** Tool filter (default: "*"). */
  tools?: string | string[];
  /** Startup timeout in ms (copilot uses ms, not seconds). */
  timeoutMs?: number;
}

export interface CopilotMcpSyncPlan {
  content?: string;
  added: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
  warnings: string[];
}

function toCopilotMcpServerConfig(
  entry: CopilotMcpServerEntry,
): Record<string, unknown> {
  const transport = entry.transport ?? (entry.url ? "http" : "stdio");
  const type = transport === "stdio" ? "local" : transport;
  const out: Record<string, unknown> = { type };
  if (type === "local") {
    if (entry.command !== undefined) out.command = entry.command;
    if (entry.args && entry.args.length > 0) out.args = [...entry.args];
    if (entry.env && Object.keys(entry.env).length > 0) out.env = { ...entry.env };
  } else {
    if (entry.url !== undefined) out.url = entry.url;
    if (entry.headers && Object.keys(entry.headers).length > 0) {
      out.headers = { ...entry.headers };
    }
  }
  if (entry.tools !== undefined) out.tools = entry.tools;
  if (entry.timeoutMs !== undefined) out.timeout = entry.timeoutMs;
  return out;
}

/**
 * Convert a shared-registry server entry (unified across codex/claude) into a
 * copilot CLI mcp-config.json entry. Shared registry assumes local stdio.
 */
export function sharedRegistryServerToCopilotEntry(
  server: UnifiedMcpRegistryServer,
): CopilotMcpServerEntry {
  return {
    name: server.name,
    command: server.command,
    args: [...server.args],
    ...(server.startupTimeoutSec !== undefined
      ? { timeoutMs: server.startupTimeoutSec * 1000 }
      : {}),
  };
}

/**
 * Plan a sync of OMCP-managed MCP servers into copilot's mcp-config.json.
 *
 * Reconciliation rules:
 * - Entries listed in the existing marker are considered OMCP-owned and are
 *   overwritten / removed freely.
 * - Entries NOT listed in the marker are treated as user-owned and preserved;
 *   if a desired entry collides with a user-owned one we warn and skip.
 * - Desired entries not currently present are added.
 * - Previously-managed entries that are no longer desired are removed.
 */
export function planCopilotMcpServersSync(
  existingContent: string,
  desired: CopilotMcpServerEntry[],
): CopilotMcpSyncPlan {
  let parsed: unknown = {};
  const trimmed = existingContent.trim();
  if (trimmed.length > 0) {
    try {
      parsed = JSON.parse(existingContent);
    } catch (error) {
      return {
        added: [],
        updated: [],
        unchanged: [],
        removed: [],
        warnings: [`failed to parse ~/.copilot/mcp-config.json: ${String(error)}`],
      };
    }
  }

  if (!isRecord(parsed)) {
    return {
      added: [],
      updated: [],
      unchanged: [],
      removed: [],
      warnings: ["~/.copilot/mcp-config.json must contain a JSON object"],
    };
  }

  const currentMcpServers = parsed.mcpServers;
  if (currentMcpServers !== undefined && !isRecord(currentMcpServers)) {
    return {
      added: [],
      updated: [],
      unchanged: [],
      removed: [],
      warnings: ['~/.copilot/mcp-config.json field "mcpServers" must be an object'],
    };
  }

  const markerValue = parsed[COPILOT_MCP_MANAGED_MARKER];
  const existingManaged: string[] = Array.isArray(markerValue)
    ? markerValue.filter((item): item is string => typeof item === "string")
    : [];

  const nextMcpServers: Record<string, unknown> = {
    ...(currentMcpServers ?? {}),
  };
  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  const warnings: string[] = [];
  const desiredNames = new Set(desired.map((d) => d.name));

  // Remove stale managed entries (previously managed, no longer desired).
  for (const name of existingManaged) {
    if (!desiredNames.has(name) && Object.hasOwn(nextMcpServers, name)) {
      delete nextMcpServers[name];
      removed.push(name);
    }
  }

  for (const entry of desired) {
    const desiredConfig = toCopilotMcpServerConfig(entry);
    const currentEntry = nextMcpServers[entry.name];
    const isManaged = existingManaged.includes(entry.name);

    if (currentEntry !== undefined && !isManaged) {
      warnings.push(
        `skipping "${entry.name}" in ~/.copilot/mcp-config.json: a user-managed entry already exists (delete it or add "${entry.name}" to ${COPILOT_MCP_MANAGED_MARKER} to let OMCP manage it)`,
      );
      continue;
    }

    if (currentEntry === undefined) {
      nextMcpServers[entry.name] = desiredConfig;
      added.push(entry.name);
    } else if (JSON.stringify(currentEntry) !== JSON.stringify(desiredConfig)) {
      nextMcpServers[entry.name] = desiredConfig;
      updated.push(entry.name);
    } else {
      unchanged.push(entry.name);
    }
  }

  const nextManaged = [...desiredNames].sort();
  const managedUnchanged =
    JSON.stringify([...existingManaged].sort()) === JSON.stringify(nextManaged);
  const serversChanged =
    added.length > 0 || updated.length > 0 || removed.length > 0;

  if (!serversChanged && managedUnchanged) {
    return { added, updated, unchanged, removed, warnings };
  }

  const { [COPILOT_MCP_MANAGED_MARKER]: _oldMarker, mcpServers: _old, ...rest } =
    parsed as Record<string, unknown>;
  const nextParsed: Record<string, unknown> = {
    ...rest,
    ...(nextManaged.length > 0
      ? { [COPILOT_MCP_MANAGED_MARKER]: nextManaged }
      : {}),
    mcpServers: nextMcpServers,
  };

  return {
    content: `${JSON.stringify(nextParsed, null, 2)}\n`,
    added,
    updated,
    unchanged,
    removed,
    warnings,
  };
}

/**
 * Plan removal of all OMCP-managed entries from copilot's mcp-config.json.
 * Used by `omcp uninstall`.
 */
export function planCopilotMcpServersRemoval(
  existingContent: string,
): CopilotMcpSyncPlan {
  const trimmed = existingContent.trim();
  if (trimmed.length === 0) {
    return { added: [], updated: [], unchanged: [], removed: [], warnings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(existingContent);
  } catch (error) {
    return {
      added: [],
      updated: [],
      unchanged: [],
      removed: [],
      warnings: [`failed to parse ~/.copilot/mcp-config.json: ${String(error)}`],
    };
  }
  if (!isRecord(parsed)) {
    return { added: [], updated: [], unchanged: [], removed: [], warnings: [] };
  }
  const markerValue = parsed[COPILOT_MCP_MANAGED_MARKER];
  const managed: string[] = Array.isArray(markerValue)
    ? markerValue.filter((item): item is string => typeof item === "string")
    : [];
  if (managed.length === 0) {
    return { added: [], updated: [], unchanged: [], removed: [], warnings: [] };
  }
  const currentMcpServers = isRecord(parsed.mcpServers) ? parsed.mcpServers : {};
  const nextMcpServers: Record<string, unknown> = { ...currentMcpServers };
  const removed: string[] = [];
  for (const name of managed) {
    if (Object.hasOwn(nextMcpServers, name)) {
      delete nextMcpServers[name];
      removed.push(name);
    }
  }

  const { [COPILOT_MCP_MANAGED_MARKER]: _m, mcpServers: _s, ...rest } =
    parsed as Record<string, unknown>;
  const nextParsed: Record<string, unknown> = {
    ...rest,
    ...(Object.keys(nextMcpServers).length > 0
      ? { mcpServers: nextMcpServers }
      : {}),
  };

  return {
    content: `${JSON.stringify(nextParsed, null, 2)}\n`,
    added: [],
    updated: [],
    unchanged: [],
    removed,
    warnings: [],
  };
}
