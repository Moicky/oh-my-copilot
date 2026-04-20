import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { parsePaneIdFromTmuxOutput, shellEscapeSingle } from '../hud/tmux.js';
import { sanitizeReplyInput } from '../notifications/reply-listener.js';
import { getCurrentTmuxPaneId } from '../notifications/tmux.js';
import { resolveTmuxBinaryForPlatform } from '../utils/platform-command.js';
import { resolveOmcpCliEntryPath } from '../utils/paths.js';
import type { QuestionAnswer, QuestionRendererState } from './types.js';

export type QuestionRendererStrategy = 'inside-tmux' | 'detached-tmux' | 'test-noop' | 'unsupported';

export interface LaunchQuestionRendererOptions {
  cwd: string;
  recordPath: string;
  sessionId?: string;
  env?: NodeJS.ProcessEnv;
  nowIso?: string;
}

export type ExecTmuxSync = (args: string[]) => string;

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isPaneId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^%\d+$/.test(value.trim());
}

export function resolveQuestionRendererStrategy(
  env: NodeJS.ProcessEnv = process.env,
  tmuxBinary = resolveTmuxBinaryForPlatform(),
): QuestionRendererStrategy {
  if (safeString(env.OMCP_QUESTION_TEST_RENDERER).trim() === 'noop') return 'test-noop';
  if (safeString(env.TMUX).trim() !== '') return 'inside-tmux';
  if (tmuxBinary) return 'detached-tmux';
  return 'unsupported';
}

function buildQuestionUiCommand(recordPath: string, sessionId?: string): string {
  const omcpBin = resolveOmcpCliEntryPath() || process.argv[1];
  if (!omcpBin) throw new Error('Unable to resolve OMCP CLI entry path for question UI launch.');
  const sessionPrefix = sessionId ? `OMCP_SESSION_ID=${shellEscapeSingle(sessionId)} ` : '';
  return `${sessionPrefix}${shellEscapeSingle(process.execPath)} ${shellEscapeSingle(omcpBin)} question --ui --state-path ${shellEscapeSingle(recordPath)}`;
}

function defaultExecTmux(args: string[]): string {
  const tmux = resolveTmuxBinaryForPlatform();
  if (!tmux) throw new Error('tmux is unavailable; omcp question requires tmux for OMCP-owned question UI rendering.');
  return execFileSync(tmux, args, {
    encoding: 'utf-8',
    ...(process.platform === 'win32' ? { windowsHide: true } : {}),
  });
}

function resolveReturnTarget(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const envPane = safeString(env.TMUX_PANE).trim();
  if (isPaneId(envPane)) return envPane;
  const detectedPane = getCurrentTmuxPaneId();
  return isPaneId(detectedPane) ? detectedPane : undefined;
}

export function formatQuestionAnswerForInjection(answer: QuestionAnswer): string {
  const prefix = '[omcp question answered]';
  if (answer.kind === 'other') {
    return sanitizeReplyInput(`${prefix} ${answer.other_text ?? String(answer.value)}`);
  }
  if (answer.kind === 'multi') {
    const raw = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value);
    return sanitizeReplyInput(`${prefix} ${raw}`);
  }
  return sanitizeReplyInput(`${prefix} ${String(answer.value)}`);
}

export function injectQuestionAnswerToPane(
  paneId: string,
  answer: QuestionAnswer,
  execTmux: ExecTmuxSync = defaultExecTmux,
): boolean {
  if (!isPaneId(paneId)) return false;
  const text = formatQuestionAnswerForInjection(answer);
  if (!text) return false;

  execTmux(['send-keys', '-t', paneId, '-l', '--', text]);
  execTmux(['send-keys', '-t', paneId, 'Enter']);
  execTmux(['send-keys', '-t', paneId, 'Enter']);
  execTmux(['send-keys', '-t', paneId, 'Enter']);
  return true;
}

export function launchQuestionRenderer(
  options: LaunchQuestionRendererOptions,
  deps: {
    strategy?: QuestionRendererStrategy;
    execTmux?: ExecTmuxSync;
  } = {},
): QuestionRendererState {
  const strategy = deps.strategy ?? resolveQuestionRendererStrategy(options.env ?? process.env);
  const execTmux = deps.execTmux ?? defaultExecTmux;
  const launchedAt = options.nowIso ?? new Date().toISOString();
  const command = buildQuestionUiCommand(options.recordPath, options.sessionId);

  if (strategy === 'inside-tmux') {
    const rawPane = execTmux([
      'split-window',
      '-v',
      '-l',
      '12',
      '-P',
      '-F',
      '#{pane_id}',
      '-c',
      options.cwd,
      command,
    ]);
    const paneId = parsePaneIdFromTmuxOutput(rawPane);
    if (!paneId) throw new Error('Failed to create tmux split pane for omcp question UI.');
    const returnTarget = resolveReturnTarget(options.env ?? process.env);
    return {
      renderer: 'tmux-pane',
      target: paneId,
      launched_at: launchedAt,
      ...(returnTarget ? { return_target: returnTarget, return_transport: 'tmux-send-keys' } : {}),
    };
  }

  if (strategy === 'detached-tmux') {
    const baseName = basename(options.recordPath, '.json').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 32) || 'question';
    const sessionName = `omcp-question-${baseName}`;
    const output = execTmux([
      'new-session',
      '-d',
      '-P',
      '-F',
      '#{session_name}',
      '-s',
      sessionName,
      '-c',
      options.cwd,
      command,
    ]).trim();
    return {
      renderer: 'tmux-session',
      target: output || sessionName,
      launched_at: launchedAt,
    };
  }

  if (strategy === 'test-noop') {
    return {
      renderer: 'tmux-session',
      target: 'test-noop-renderer',
      launched_at: launchedAt,
    };
  }

  throw new Error('omcp question requires tmux for OMCP-owned question UI rendering in this session.');
}
