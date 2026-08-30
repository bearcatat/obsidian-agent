/// <reference types="node" />
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEFAULT_TIMEOUT = 60000;
const MAX_OUTPUT_SIZE = 100 * 1024;
let windowsSpawnMutex: Promise<void> = Promise.resolve();

export type ShellConfig = {
  shell: string;
  args: string[];
  encoding: BufferEncoding;
  displayName?: string;
};

export interface BashShellInfo {
  name: string;
  version?: string;
}

export type ExecuteResult = {
  output: string;
  exitCode: number;
  error: string;
  shell?: BashShellInfo;
  /** The configured shell or cwd could not be started; no user command ran. */
  startupFailed?: boolean;
};

export function getUnixShellConfig(): ShellConfig {
  return { shell: '/bin/bash', args: ['-c'], encoding: 'utf8' };
}

function existingExecutable(candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // An unreadable candidate cannot be used as a shell executable.
    }
  }
  return undefined;
}

function pathCandidates(executable: string): string[] {
  return (process.env.Path ?? process.env.PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
    .map((entry) => path.join(entry, executable));
}

/**
 * Resolve the sole Windows command shell. PowerShell 7 is preferred; Windows
 * PowerShell is the only supported fallback. Returning undefined is deliberate:
 * callers must fail closed instead of trying another shell.
 */
export function getWindowsPowerShellConfig(): ShellConfig | undefined {
  const pwsh = existingExecutable([
    ...pathCandidates('pwsh.exe'),
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'PowerShell', '7', 'pwsh.exe') : '',
  ]);
  if (pwsh) return { shell: pwsh, args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'], encoding: 'utf8', displayName: 'PowerShell 7' };

  const windowsRoot = process.env.SystemRoot ?? process.env.WINDIR;
  const legacyPowerShell = existingExecutable([
    ...pathCandidates('powershell.exe'),
    windowsRoot ? path.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '',
  ]);
  if (legacyPowerShell) return { shell: legacyPowerShell, args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'], encoding: 'utf8', displayName: 'Windows PowerShell' };

  return undefined;
}

export function getWindowsPowerShellInfo(config: ShellConfig): BashShellInfo {
  return { name: config.displayName ?? 'PowerShell' };
}

/**
 * `CreateProcess` inherits this Node process's environment. Limit temporary
 * TMP/TEMP overrides to the synchronous child-creation window, serializing
 * every Windows child creation in this module so another invocation cannot
 * inherit the private sandbox temp directory.
 */
export type WindowsChildEnvironment = {
  pathPrefix?: string;
  curlCaBundlePath?: string;
};

type WindowsEnvironmentSnapshot = ReadonlyArray<readonly [string, string | undefined]>;

function snapshotWindowsEnvironment(name: string): WindowsEnvironmentSnapshot {
  return Object.keys(process.env)
    .filter((key) => key.toLowerCase() === name.toLowerCase())
    .map((key) => [key, process.env[key]] as const);
}

function setWindowsEnvironment(name: string, value: string): void {
  const existing = snapshotWindowsEnvironment(name)[0]?.[0];
  for (const [key] of snapshotWindowsEnvironment(name)) delete process.env[key];
  process.env[existing ?? name] = value;
}

function restoreWindowsEnvironment(name: string, snapshot: WindowsEnvironmentSnapshot): void {
  for (const [key] of snapshotWindowsEnvironment(name)) delete process.env[key];
  for (const [key, value] of snapshot) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export async function spawnWithWindowsEnvironment<T>(tempDir: string | undefined, operation: () => T, environment: WindowsChildEnvironment = {}): Promise<T> {
  if (process.platform !== 'win32') return operation();

  const previous = windowsSpawnMutex;
  let release: (() => void) | undefined;
  windowsSpawnMutex = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  const tmp = snapshotWindowsEnvironment('TMP');
  const temp = snapshotWindowsEnvironment('TEMP');
  const pathSnapshot = environment.pathPrefix ? snapshotWindowsEnvironment('Path') : undefined;
  const curlCaBundle = environment.curlCaBundlePath ? snapshotWindowsEnvironment('CURL_CA_BUNDLE') : undefined;
  try {
    if (tempDir) {
      setWindowsEnvironment('TMP', tempDir);
      setWindowsEnvironment('TEMP', tempDir);
    }
    if (environment.pathPrefix) {
      const original = pathSnapshot?.[0]?.[1] ?? '';
      const entries = original.split(path.delimiter).filter(Boolean);
      const prefix = path.resolve(environment.pathPrefix);
      setWindowsEnvironment('Path', [prefix, ...entries.filter((entry) => path.resolve(entry) !== prefix)].join(path.delimiter));
    }
    if (environment.curlCaBundlePath) setWindowsEnvironment('CURL_CA_BUNDLE', environment.curlCaBundlePath);
    return operation();
  } finally {
    if (tempDir) {
      restoreWindowsEnvironment('TMP', tmp);
      restoreWindowsEnvironment('TEMP', temp);
    }
    if (pathSnapshot) restoreWindowsEnvironment('Path', pathSnapshot);
    if (curlCaBundle) restoreWindowsEnvironment('CURL_CA_BUNDLE', curlCaBundle);
    release?.();
  }
}

export interface BashExecutionRequest {
  command: string;
  cwd: string;
  timeout?: number;
}

export interface BashExecutor {
  readonly isolation: "none" | "sandbox";
  execute(request: BashExecutionRequest, signal?: AbortSignal): Promise<ExecuteResult>;
}

export async function runWithShell(command: string, cwd: string, timeoutMs: number, config: ShellConfig, signal?: AbortSignal, windowsToolPath?: string, windowsCaBundlePath?: string): Promise<ExecuteResult | { enotent: true }> {
  if (signal?.aborted) return { output: 'Command cancelled', exitCode: 130, error: 'Cancelled' };

  let child: ChildProcessWithoutNullStreams;
  try {
    child = await spawnWithWindowsEnvironment(undefined, () => spawn(config.shell, [...config.args, command], {
      cwd: cwd || undefined,
      shell: false,
      windowsHide: true,
    }), { pathPrefix: windowsToolPath, curlCaBundlePath: windowsCaBundlePath });
  } catch (error) {
    return { output: '', exitCode: 125, error: error instanceof Error ? error.message : 'Command shell failed to start', startupFailed: true };
  }

  return await new Promise((resolve) => {
    const stdoutBuffers: Buffer[] = [];
    const stderrBuffers: Buffer[] = [];

    child.stdout?.on('data', (data: Buffer) => stdoutBuffers.push(data));
    child.stderr?.on('data', (data: Buffer) => stderrBuffers.push(data));

    let timeoutHandle: NodeJS.Timeout | null = null;
    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      try {
        child.kill('SIGKILL');
      } catch (e) {
        // Ignore kill errors during cancellation.
      }
    };
    signal?.addEventListener('abort', handleAbort, { once: true });

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (e) {
          // Ignore kill errors.
        }
      }, timeoutMs);
    }

    child.on('close', (code: number | null) => {
      cleanup();
      const stdoutBuf = Buffer.concat(stdoutBuffers);
      const stderrBuf = Buffer.concat(stderrBuffers);

      let output = stdoutBuf.toString(config.encoding);
      let errorOutput = stderrBuf.toString(config.encoding);

      if (output.length > MAX_OUTPUT_SIZE) {
        output = output.substring(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
      }

      if (errorOutput.length > MAX_OUTPUT_SIZE) {
        errorOutput = errorOutput.substring(0, MAX_OUTPUT_SIZE) + '\n... (error truncated)';
      }

      if (signal?.aborted) {
        resolve({ output: 'Command cancelled', exitCode: 130, error: 'Cancelled' });
      } else if (code === null) {
        resolve({ output: 'Command timed out', exitCode: 124, error: 'Timeout' });
      } else {
        resolve({ output, exitCode: code || 0, error: errorOutput });
      }
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      if (error.code === 'ENOENT') {
        resolve({ enotent: true });
        return;
      }
      resolve({ output: '', exitCode: 125, error: error.message || 'Command shell failed to start', startupFailed: true });
    });
  });
}

export async function executeCommand(command: string, cwd: string, timeout?: number, signal?: AbortSignal, windowsToolPath?: string, windowsCaBundlePath?: string): Promise<ExecuteResult> {
  const timeoutMs = timeout ?? DEFAULT_TIMEOUT;

  if (process.platform !== 'win32') {
    const cfg = getUnixShellConfig();
    const result = await runWithShell(command, cwd, timeoutMs, cfg, signal);
    return 'enotent' in result ? { output: '', exitCode: 1, error: 'Shell not found' } : result;
  }

  const config = getWindowsPowerShellConfig();
  if (!config) return { output: '', exitCode: 125, error: 'PowerShell 7 and Windows PowerShell are unavailable', startupFailed: true };
  const result = await runWithShell(command, cwd, timeoutMs, config, signal, windowsToolPath, windowsCaBundlePath);
  if ('enotent' in result) return { output: '', exitCode: 125, error: 'PowerShell failed to start', startupFailed: true };
  return { ...result, shell: getWindowsPowerShellInfo(config) };
}

export const localBashExecutor: BashExecutor = {
  isolation: "none",
  execute: ({ command, cwd, timeout }, signal) => executeCommand(command, cwd, timeout, signal),
};
