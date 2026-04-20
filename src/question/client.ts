import { spawn } from 'node:child_process';
import { resolveOmcpCliEntryPath } from '../utils/paths.js';
import type { QuestionAnswer, QuestionInput } from './types.js';

export interface OmcpQuestionSuccessPayload {
  ok: true;
  question_id: string;
  session_id?: string;
  prompt: QuestionInput;
  answer: QuestionAnswer;
}

export interface OmcpQuestionErrorPayload {
  ok: false;
  question_id?: string;
  session_id?: string;
  error: {
    code: string;
    message: string;
  };
}

export type OmcpQuestionPayload = OmcpQuestionSuccessPayload | OmcpQuestionErrorPayload;

export interface OmcpQuestionClientOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  argv1?: string | null;
  runner?: OmcpQuestionProcessRunner;
}

export interface OmcpQuestionProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type OmcpQuestionProcessRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<OmcpQuestionProcessResult>;

export class OmcpQuestionError extends Error {
  readonly code: string;
  readonly payload?: OmcpQuestionErrorPayload;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor(
    code: string,
    message: string,
    options: {
      payload?: OmcpQuestionErrorPayload;
      stdout?: string;
      stderr?: string;
      exitCode?: number | null;
    } = {},
  ) {
    super(`${code}: ${message}`);
    this.name = 'OmcpQuestionError';
    this.code = code;
    this.payload = options.payload;
    this.stdout = options.stdout ?? '';
    this.stderr = options.stderr ?? '';
    this.exitCode = options.exitCode ?? null;
  }
}

export async function defaultOmcpQuestionProcessRunner(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<OmcpQuestionProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function parseQuestionStdout(stdout: string, stderr: string, exitCode: number | null): OmcpQuestionPayload {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new OmcpQuestionError('question_no_stdout', 'omcp question did not emit a JSON response on stdout.', {
      stdout,
      stderr,
      exitCode,
    });
  }

  try {
    return JSON.parse(trimmed) as OmcpQuestionPayload;
  } catch (error) {
    throw new OmcpQuestionError(
      'question_invalid_stdout',
      `omcp question emitted invalid JSON on stdout: ${(error as Error).message}`,
      { stdout, stderr, exitCode },
    );
  }
}

export async function runOmcpQuestion(
  input: Partial<QuestionInput> & { question: string },
  options: OmcpQuestionClientOptions = {},
): Promise<OmcpQuestionSuccessPayload> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const omcpBin = resolveOmcpCliEntryPath({ argv1: options.argv1, cwd, env });
  if (!omcpBin) {
    throw new OmcpQuestionError('question_cli_not_found', 'Could not resolve the omcp CLI entrypoint for blocking question execution.');
  }

  const runner = options.runner ?? defaultOmcpQuestionProcessRunner;
  const result = await runner(
    process.execPath,
    [omcpBin, 'question', '--json', '--input', JSON.stringify(input)],
    { cwd, env },
  );
  const payload = parseQuestionStdout(result.stdout, result.stderr, result.code);

  if (!payload.ok) {
    throw new OmcpQuestionError(payload.error.code, payload.error.message, {
      payload,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    });
  }

  if (result.code !== 0) {
    throw new OmcpQuestionError(
      'question_nonzero_exit',
      `omcp question returned an answer but exited with code ${result.code}.`,
      { stdout: result.stdout, stderr: result.stderr, exitCode: result.code },
    );
  }

  return payload;
}
