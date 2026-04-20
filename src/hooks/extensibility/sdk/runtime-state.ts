import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import type {
  HookPluginOmcpHudState,
  HookPluginOmcpNotifyFallbackState,
  HookPluginOmcpSessionState,
  HookPluginOmcpUpdateCheckState,
  HookPluginSdk,
} from '../types.js';
import { omcpRootStateFilePath } from './paths.js';
import { getReadScopedStateFilePaths } from '../../../mcp/state-paths.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readOmcpStateFile<T extends Record<string, unknown>>(
  path: string,
  normalize?: (value: Record<string, unknown>) => T | null,
): Promise<T | null> {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as unknown;
    if (!isRecord(parsed)) return null;
    return normalize ? normalize(parsed) : parsed as T;
  } catch {
    return null;
  }
}

function normalizeSessionState(value: Record<string, unknown>): HookPluginOmcpSessionState | null {
  return typeof value.session_id === 'string' && value.session_id.trim()
    ? value as HookPluginOmcpSessionState
    : null;
}

export function createHookPluginOmcpApi(cwd: string): HookPluginSdk['omcp'] {
  return {
    session: {
      read: () => readOmcpStateFile<HookPluginOmcpSessionState>(
        omcpRootStateFilePath(cwd, 'session.json'),
        normalizeSessionState,
      ),
    },
    hud: {
      read: async () => {
        const [hudStatePath] = await getReadScopedStateFilePaths('hud-state.json', cwd, undefined, {
          rootFallback: false,
        });
        return readOmcpStateFile<HookPluginOmcpHudState>(hudStatePath);
      },
    },
    notifyFallback: {
      read: () => readOmcpStateFile<HookPluginOmcpNotifyFallbackState>(
        omcpRootStateFilePath(cwd, 'notify-fallback-state.json'),
      ),
    },
    updateCheck: {
      read: () => readOmcpStateFile<HookPluginOmcpUpdateCheckState>(
        omcpRootStateFilePath(cwd, 'update-check.json'),
      ),
    },
  };
}
