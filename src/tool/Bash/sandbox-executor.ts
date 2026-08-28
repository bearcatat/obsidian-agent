/// <reference types="node" />
import { spawn } from 'child_process';
import { mkdtempSync, realpathSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import type { BashOutcomeStatus, BashSandboxMode } from '@/types';
import { executeCommand, getUnixShellConfig, getWindowsPowerShellInfo, getWindowsPowerShellConfig, spawnWithWindowsEnvironment, type ExecuteResult } from './execute-command';
import { AclSandbox } from '@deepseek-ai/dsh-sandbox-windows-acl';
import { BashSessionTempManager } from './bash-session-temp-manager';

export interface SandboxedExecutionResult extends ExecuteResult {
  status: Extract<BashOutcomeStatus, 'success' | 'command-failed' | 'sandbox-denied' | 'sandbox-unavailable' | 'cancelled'>;
  backend: 'windows-acl' | 'seatbelt' | 'host' | 'unsupported';
  enforcement: 'write-restricted' | 'full-access' | 'unavailable';
}

export function isBashSandboxPlatformSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}

function unavailable(error: unknown, backend: SandboxedExecutionResult['backend']): SandboxedExecutionResult {
  return {
    output: '', exitCode: 125,
    error: error instanceof Error ? error.message : 'Bash sandbox is unavailable',
    status: 'sandbox-unavailable', backend, enforcement: 'unavailable',
  };
}

function resultStatus(result: ExecuteResult): Extract<BashOutcomeStatus, 'success' | 'command-failed' | 'cancelled'> {
  if (result.error === 'Cancelled') return 'cancelled';
  return Number.isInteger(result.exitCode) && result.exitCode === 0 && !result.error.trim() ? 'success' : 'command-failed';
}

function seatbeltString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildSeatbeltProfile(mode: Exclude<BashSandboxMode, 'full-access'>, workspaceRoot: string, tempDir?: string): string {
  const workspace = seatbeltString(workspaceRoot);
  const parts = [
    '(version 1)',
    '(allow default)',
    '(deny file-write*)',
  ];
  if (mode === 'workspace-write') {
    parts.push(`(allow file-write* (subpath "${workspace}"))`);
    if (tempDir) parts.push(`(allow file-write* (subpath "${seatbeltString(tempDir)}"))`);
  }
  return parts.join('\n');
}

async function executeSeatbelt(command: string, cwd: string, timeout: number | undefined, mode: Exclude<BashSandboxMode, 'full-access'>, signal?: AbortSignal): Promise<SandboxedExecutionResult> {
  const tempDir = mode === 'workspace-write' ? mkdtempSync(path.join(os.tmpdir(), 'obsidian-agent-bash-')) : undefined;
  const shell = getUnixShellConfig();
  const profile = buildSeatbeltProfile(mode, cwd, tempDir);
  try {
    const result = await new Promise<ExecuteResult>((resolve) => {
      const child = spawn('/usr/bin/sandbox-exec', ['-p', profile, shell.shell, ...shell.args, command], {
        cwd,
        shell: false,
        detached: true,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout?.on('data', (data: Buffer) => stdout.push(data));
      child.stderr?.on('data', (data: Buffer) => stderr.push(data));
      let timedOut = false;
      const kill = () => {
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      };
      const timer = timeout && timeout > 0 ? setTimeout(() => { timedOut = true; kill(); }, timeout) : undefined;
      const onAbort = () => kill();
      signal?.addEventListener('abort', onAbort, { once: true });
      child.on('error', (error) => resolve({ output: '', exitCode: 125, error: error.message }));
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (signal?.aborted) return resolve({ output: 'Command cancelled', exitCode: 130, error: 'Cancelled' });
        if (timedOut) return resolve({ output: 'Command timed out', exitCode: 124, error: 'Timeout' });
        resolve({ output: Buffer.concat(stdout).toString('utf8'), exitCode: code ?? 1, error: Buffer.concat(stderr).toString('utf8') });
      });
    });
    const denied = /(?:Operation not permitted|Permission denied|deny\()/i.test(result.error);
    return { ...result, status: denied ? 'sandbox-denied' : resultStatus(result), backend: 'seatbelt', enforcement: 'write-restricted' };
  } catch (error) {
    return unavailable(error, 'seatbelt');
  } finally {
    if (tempDir) {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* report only a command result */ }
    }
  }
}

function canonicalWorkspaceRoot(cwd: string): string {
  const canonical = realpathSync.native(cwd);
  if (!path.isAbsolute(canonical)) throw new Error('Canonical Vault path is not absolute');
  return canonical;
}

async function executeWindowsAcl(command: string, cwd: string, mode: Exclude<BashSandboxMode, 'full-access'>, conversationId: string, signal?: AbortSignal): Promise<SandboxedExecutionResult> {
  let lease: Awaited<ReturnType<BashSessionTempManager['acquire']>> | undefined;
  try {
    const shell = getWindowsPowerShellConfig();
    if (!shell) return unavailable('PowerShell 7 and Windows PowerShell are unavailable', 'windows-acl');
    const workspaceRoot = canonicalWorkspaceRoot(cwd);
    lease = await BashSessionTempManager.getInstance().acquire(workspaceRoot, conversationId, mode);
    const sandbox = mode === 'workspace-write'
      ? new AclSandbox({
        mode,
        writableDirs: [workspaceRoot],
        tempDir: lease.tempDir,
        writeSid: lease.writeSid,
        tempWriteSid: lease.tempWriteSid,
        manageDacls: false,
      })
      // DSH's read-only token contains an ambient write-capable SID. Use a
      // workspace-write token with no workspace grants instead: its otherwise
      // unused write SID is per-invocation, while the separately granted temp
      // SID permits only this command's private TMP/TEMP directory.
      : new AclSandbox({
        mode: 'workspace-write',
        writableDirs: [],
        tempDir: lease.tempDir,
        writeSid: lease.writeSid,
        tempWriteSid: lease.tempWriteSid,
        manageDacls: false,
      });
    await sandbox.init();
    try {
      if (signal?.aborted) return { output: 'Command cancelled', exitCode: 130, error: 'Cancelled', status: 'cancelled', backend: 'windows-acl', enforcement: 'write-restricted' };
      const child = await spawnWithWindowsEnvironment(lease.tempDir, () => sandbox.spawn({
        command: shell.shell,
        args: [...shell.args, command],
        cwd: workspaceRoot,
        stdio: 'pipe',
      }));
      const settled = await child.wait();
      const result: ExecuteResult = {
        output: settled.stdout.toString(shell.encoding),
        exitCode: settled.exitCode,
        error: settled.stderr.toString(shell.encoding),
        shell: getWindowsPowerShellInfo(shell),
      };
      if (signal?.aborted) return { output: 'Command cancelled', exitCode: 130, error: 'Cancelled', status: 'cancelled', backend: 'windows-acl', enforcement: 'write-restricted' };
      return { ...result, status: resultStatus(result), backend: 'windows-acl', enforcement: 'write-restricted' };
    } finally {
      sandbox.dispose();
    }
  } catch (error) {
    return unavailable(error, 'windows-acl');
  } finally {
    await lease?.release();
  }
}
export async function executeSandboxedBash(params: { command: string; cwd: string; timeout?: number; mode: BashSandboxMode; conversationId?: string }, signal?: AbortSignal): Promise<SandboxedExecutionResult> {
  if (!isBashSandboxPlatformSupported()) return unavailable('Bash is supported only on Windows and macOS Desktop', 'unsupported');
  if (params.mode === 'full-access') {
    try {
      const cwd = process.platform === 'win32' ? canonicalWorkspaceRoot(params.cwd) : params.cwd;
      const result = await executeCommand(params.command, cwd, params.timeout, signal);
      if (result.startupFailed) return { ...result, status: 'sandbox-unavailable', backend: 'host', enforcement: 'unavailable' };
      return { ...result, status: resultStatus(result), backend: 'host', enforcement: 'full-access' };
    } catch (error) {
      return unavailable(error, 'host');
    }
  }
  if (!params.cwd) return unavailable('The Vault filesystem path is unavailable', process.platform === 'win32' ? 'windows-acl' : 'seatbelt');
  if (process.platform === 'win32' && (!params.conversationId || typeof params.conversationId !== 'string')) {
    return unavailable('Bash sandbox requires a persistent conversation ID', 'windows-acl');
  }
  return process.platform === 'win32'
    ? executeWindowsAcl(params.command, params.cwd, params.mode, params.conversationId!, signal)
    : executeSeatbelt(params.command, params.cwd, params.timeout, params.mode, signal);
}
