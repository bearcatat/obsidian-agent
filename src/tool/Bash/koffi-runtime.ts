/// <reference types="node" />
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import x64Payload from './koffi-payloads/koffi-win32-x64.node';
import arm64Payload from './koffi-payloads/koffi-win32-arm64.node';

const KOFFI_VERSION = '3.1.2';
const PLUGIN_CACHE_SEGMENTS = ['obsidian-agent', 'native', 'koffi'];

interface EmbeddedPayload {
  arch: 'x64' | 'arm64';
  base64: string;
  byteLength: number;
  sha256: string;
}

const PAYLOADS: Record<EmbeddedPayload['arch'], EmbeddedPayload> = {
  x64: {
    arch: 'x64',
    base64: x64Payload,
    byteLength: 1_544_192,
    sha256: '2470bca8e26730762ca4b21ba15f233a45bf7f57bf2340826b9435843ea8cc14',
  },
  arm64: {
    arch: 'arm64',
    base64: arm64Payload,
    byteLength: 1_331_200,
    sha256: '74f6b141bb28d59acbc067878afc7bb266d0bf2d3f4d9b20107188243bce9979',
  },
};

let loadedNative: unknown;
let loadedPath: string | undefined;

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function resolveUserDataPath(): string {
  try {
    // Obsidian exposes Electron's main app through remote in its desktop renderer.
    // Do not fall back to the Vault or a generic system temp directory: a missing
    // user-data path is a backend initialization failure and must fail closed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { app?: { getPath?: (name: string) => string }; remote?: { app?: { getPath?: (name: string) => string } } };
    const app = electron.remote?.app ?? electron.app;
    const userData = app?.getPath?.('userData');
    if (!userData || !path.isAbsolute(userData)) throw new Error('Electron userData path is unavailable');
    return userData;
  } catch (error) {
    throw new Error(`Koffi cache cannot resolve Electron user-data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolvePayload(): EmbeddedPayload {
  if (process.arch === 'x64') return PAYLOADS.x64;
  if (process.arch === 'arm64') return PAYLOADS.arm64;
  throw new Error(`Unsupported Windows architecture for embedded Koffi: ${process.arch}`);
}

function verifyPayload(buffer: Buffer, payload: EmbeddedPayload): void {
  if (buffer.byteLength !== payload.byteLength) throw new Error(`Koffi payload size mismatch for ${payload.arch}`);
  if (sha256(buffer) !== payload.sha256) throw new Error(`Koffi payload hash mismatch for ${payload.arch}`);
}

function cacheRoot(userData: string): string {
  const root = path.resolve(userData, ...PLUGIN_CACHE_SEGMENTS);
  const expectedPrefix = `${path.resolve(userData)}${path.sep}`;
  if (!root.startsWith(expectedPrefix)) throw new Error('Koffi cache root escapes Electron user-data');
  return root;
}

function cleanupOldVersions(root: string): void {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === KOFFI_VERSION) continue;
    const target = path.resolve(root, entry.name);
    if (path.dirname(target) !== path.resolve(root)) continue;
    try { rmSync(target, { recursive: true, force: true }); } catch { /* failed cache cleanup must not broaden its scope */ }
  }
}

function provisionPayload(payload: EmbeddedPayload): string {
  const source = Buffer.from(payload.base64, 'base64');
  verifyPayload(source, payload);
  const root = cacheRoot(resolveUserDataPath());
  const targetDir = path.join(root, KOFFI_VERSION, payload.arch);
  const targetPath = path.join(targetDir, 'koffi.node');
  mkdirSync(targetDir, { recursive: true });
  cleanupOldVersions(root);

  if (existsSync(targetPath)) {
    const existing = Buffer.from(require('fs').readFileSync(targetPath));
    verifyPayload(existing, payload);
    return targetPath;
  }

  const tempPath = path.join(targetDir, `.koffi-${randomUUID()}.tmp`);
  try {
    writeFileSync(tempPath, source, { flag: 'wx' });
    verifyPayload(Buffer.from(require('fs').readFileSync(tempPath)), payload);
    renameSync(tempPath, targetPath);
    verifyPayload(Buffer.from(require('fs').readFileSync(targetPath)), payload);
    return targetPath;
  } catch (error) {
    try { if (existsSync(tempPath)) rmSync(tempPath, { force: true }); } catch { /* preserve original provisioning error */ }
    throw error;
  }
}

/** Returns the verified absolute native-module path. Windows only. */
export function prepareEmbeddedKoffi(): string {
  if (process.platform !== 'win32') throw new Error('Embedded Koffi is Windows-only');
  const payload = resolvePayload();
  const target = provisionPayload(payload);
  if (!path.isAbsolute(target) || statSync(target).size !== payload.byteLength) throw new Error('Koffi cache payload is invalid');
  return target;
}

/** Loads the payload only after `prepareEmbeddedKoffi()` has verified its absolute path. */
export function getEmbeddedKoffi(): unknown {
  const target = prepareEmbeddedKoffi();
  if (loadedNative && loadedPath === target) return loadedNative;
  // Native Node modules must be loaded by absolute path; no package/PATH lookup is allowed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const native = require(target) as { version?: string };
  if (native.version !== KOFFI_VERSION) throw new Error(`Embedded Koffi version mismatch: ${native.version ?? 'unknown'}`);
  loadedNative = native;
  loadedPath = target;
  return native;
}

export function getEmbeddedKoffiManifest(): Readonly<Record<EmbeddedPayload['arch'], Omit<EmbeddedPayload, 'base64'>>> {
  return {
    x64: { arch: PAYLOADS.x64.arch, byteLength: PAYLOADS.x64.byteLength, sha256: PAYLOADS.x64.sha256 },
    arm64: { arch: PAYLOADS.arm64.arch, byteLength: PAYLOADS.arm64.byteLength, sha256: PAYLOADS.arm64.sha256 },
  };
}
