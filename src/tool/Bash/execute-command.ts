/// <reference types="node" />
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEFAULT_TIMEOUT = 60000;
const MAX_OUTPUT_SIZE = 100 * 1024;

type ShellConfig = {
  shell: string;
  args: string[];
  encoding: BufferEncoding;
};

type ExecuteResult = {
  output: string;
  exitCode: number;
  error: string;
};

function getUnixShellConfig(): ShellConfig {
  return { shell: '/bin/bash', args: ['-c'], encoding: 'utf8' };
}

function getWindowsGitBashConfig(): ShellConfig {
  const shellEnv = process.env.SHELL;
  if (shellEnv && shellEnv.toLowerCase().includes('bash')) {
    return { shell: shellEnv, args: ['-lc'], encoding: 'utf8' };
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
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return { shell: p, args: ['--noprofile', '--norc', '-lc'], encoding: 'utf8' };
      }
    } catch (e) {
      // Ignore fs errors and try next.
    }
  }

  return { shell: 'bash.exe', args: ['--noprofile', '--norc', '-lc'], encoding: 'utf8' };
}

function getWindowsCmdConfig(): ShellConfig {
  // cmd.exe: use /u for UTF-16LE output
  return { shell: 'cmd.exe', args: ['/u', '/c'], encoding: 'utf16le' };
}

async function runWithShell(command: string, cwd: string, timeoutMs: number, config: ShellConfig): Promise<ExecuteResult | { enotent: true }> {
  return await new Promise((resolve) => {
    const child = spawn(config.shell, [...config.args, command], {
      cwd: cwd || undefined,
      shell: false,
      windowsHide: true,
    });

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
    };

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

      if (code === null) {
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
      resolve({ output: '', exitCode: 1, error: error.message || 'Command spawn failed' });
    });
  });
}

export async function executeCommand(command: string, cwd: string, timeout?: number): Promise<ExecuteResult> {
  const timeoutMs = timeout ?? DEFAULT_TIMEOUT;

  if (process.platform !== 'win32') {
    const cfg = getUnixShellConfig();
    const result = await runWithShell(command, cwd, timeoutMs, cfg);
    return 'enotent' in result ? { output: '', exitCode: 1, error: 'Shell not found' } : result;
  }

  const bashCfg = getWindowsGitBashConfig();
  const bashResult = await runWithShell(command, cwd, timeoutMs, bashCfg);
  if (!('enotent' in bashResult)) {
    return bashResult;
  }

  const cmdCfg = getWindowsCmdConfig();
  const cmdResult = await runWithShell(command, cwd, timeoutMs, cmdCfg);
  return 'enotent' in cmdResult ? { output: '', exitCode: 1, error: 'Shell not found' } : cmdResult;
}
