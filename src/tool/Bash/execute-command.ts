/// <reference types="node" />
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEFAULT_TIMEOUT = 60000;
const MAX_OUTPUT_SIZE = 100 * 1024;

type ShellConfig = {
  shell: string;
  args: string[];
  encoding: BufferEncoding;
  displayName: string;
};

export interface BashShellInfo {
  name: string;
}

export type ExecuteResult = {
  output: string;
  exitCode: number;
  error: string;
  shell?: BashShellInfo;
  startupFailed?: boolean;
};

export function isBashHostPlatformSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}

function getUnixShellConfig(): ShellConfig {
  return { shell: '/bin/bash', args: ['-c'], encoding: 'utf8', displayName: 'Bash' };
}

function getWindowsGitBashConfig(): ShellConfig {
  const shellEnv = process.env.SHELL;
  if (shellEnv && shellEnv.toLowerCase().includes('bash')) {
    return { shell: shellEnv, args: ['-lc'], encoding: 'utf8', displayName: 'Git Bash' };
  }

  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  const localAppData = process.env.LocalAppData;
  const candidates = [
    programFiles ? path.join(programFiles, 'Git', 'bin', 'bash.exe') : undefined,
    programFiles ? path.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe') : undefined,
    programFilesX86 ? path.join(programFilesX86, 'Git', 'bin', 'bash.exe') : undefined,
    programFilesX86 ? path.join(programFilesX86, 'Git', 'usr', 'bin', 'bash.exe') : undefined,
    localAppData ? path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe') : undefined,
    localAppData ? path.join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'bash.exe') : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return { shell: candidate, args: ['--noprofile', '--norc', '-lc'], encoding: 'utf8', displayName: 'Git Bash' };
    } catch {
      // Continue with the remaining conventional Git for Windows locations.
    }
  }

  return { shell: 'bash.exe', args: ['--noprofile', '--norc', '-lc'], encoding: 'utf8', displayName: 'Git Bash' };
}

function getWindowsCmdConfig(): ShellConfig {
  return { shell: 'cmd.exe', args: ['/u', '/c'], encoding: 'utf16le', displayName: 'Windows Command Prompt' };
}

function runWithShell(command: string, cwd: string, timeoutMs: number, config: ShellConfig, signal?: AbortSignal): Promise<ExecuteResult | { enotent: true }> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ output: 'Command cancelled', exitCode: 130, error: 'Cancelled' });
      return;
    }

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(config.shell, [...config.args, command], { cwd: cwd || undefined, shell: false, windowsHide: true });
    } catch (error) {
      resolve({ output: '', exitCode: 125, error: error instanceof Error ? error.message : 'Command shell failed to start', startupFailed: true });
      return;
    }

    const stdoutBuffers: Buffer[] = [];
    const stderrBuffers: Buffer[] = [];
    child.stdout?.on('data', (data: Buffer) => stdoutBuffers.push(data));
    child.stderr?.on('data', (data: Buffer) => stderrBuffers.push(data));

    let timeoutHandle: NodeJS.Timeout | undefined;
    const stop = () => {
      try { child.kill('SIGKILL'); } catch { /* The process is already gone. */ }
    };
    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      signal?.removeEventListener('abort', stop);
    };
    signal?.addEventListener('abort', stop, { once: true });
    if (timeoutMs > 0) timeoutHandle = setTimeout(stop, timeoutMs);

    child.on('close', (code) => {
      cleanup();
      let output = Buffer.concat(stdoutBuffers).toString(config.encoding);
      let error = Buffer.concat(stderrBuffers).toString(config.encoding);
      if (output.length > MAX_OUTPUT_SIZE) output = `${output.slice(0, MAX_OUTPUT_SIZE)}\n... (output truncated)`;
      if (error.length > MAX_OUTPUT_SIZE) error = `${error.slice(0, MAX_OUTPUT_SIZE)}\n... (error truncated)`;
      if (signal?.aborted) resolve({ output: 'Command cancelled', exitCode: 130, error: 'Cancelled', shell: { name: config.displayName } });
      else if (code === null) resolve({ output: 'Command timed out', exitCode: 124, error: 'Timeout', shell: { name: config.displayName } });
      else resolve({ output, exitCode: code, error, shell: { name: config.displayName } });
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      if (error.code === 'ENOENT') resolve({ enotent: true });
      else resolve({ output: '', exitCode: 125, error: error.message || 'Command shell failed to start', startupFailed: true, shell: { name: config.displayName } });
    });
  });
}

export async function executeCommand(command: string, cwd: string, timeout?: number, signal?: AbortSignal): Promise<ExecuteResult> {
  const timeoutMs = timeout ?? DEFAULT_TIMEOUT;
  if (process.platform === 'darwin') {
    const result = await runWithShell(command, cwd, timeoutMs, getUnixShellConfig(), signal);
    return 'enotent' in result ? { output: '', exitCode: 125, error: 'Bash is unavailable', startupFailed: true } : result;
  }
  if (process.platform === 'win32') {
    const bashResult = await runWithShell(command, cwd, timeoutMs, getWindowsGitBashConfig(), signal);
    if (!('enotent' in bashResult)) return bashResult;
    const cmdResult = await runWithShell(command, cwd, timeoutMs, getWindowsCmdConfig(), signal);
    return 'enotent' in cmdResult ? { output: '', exitCode: 125, error: 'Git Bash and Windows Command Prompt are unavailable', startupFailed: true } : cmdResult;
  }
  return { output: '', exitCode: 125, error: 'Bash is available only on Windows and macOS Desktop', startupFailed: true };
}
