/// <reference types="node" />
import { requestUrl } from 'obsidian';
import { unzipSync } from 'fflate';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export type ManagedCurlPreparation = {
  dependency: 'managed-curl';
  status: 'not-needed' | 'ready' | 'fallback-old' | 'failed';
  binPath?: string;
  caBundlePath?: string;
  errorCode?: 'download' | 'archive-hash' | 'allowlist' | 'file-hash' | 'pe-arch' | 'filesystem' | 'cancelled';
  error?: string;
};

export type Architecture = 'x64' | 'arm64';
export type ManagedCurlFileSpec = { archivePath: string; installPath: string; bytes: number; sha256: string; peMachine?: number };
export type ManagedCurlCatalog = { version: string; arch: Architecture; url: string; archiveSha256: string; archiveRoot: string; files: readonly ManagedCurlFileSpec[] };
export type ManagedCurlDownload = { status: number; arrayBuffer: ArrayBuffer };

const VERSION = '8.21.0_7';
const CA_SHA = '385ab0f472bd83b54421bee302f9b841bbac12310805fccf7debba16d84fafd0';
const LICENSES: readonly [string, number, string][] = [
  ['COPYING.txt', 1088, '82f2f4427d6545ee5aaac4f0b80428da6cc8ba41c2cf5da3a03680ec327b9681'],
  ['README.txt', 1474, 'd5655c4db1b2dc2928ecebbd227dbec5e93422b15aa42d63c8e1ef2a42b938fb'],
  ['BUILD-MANIFEST.txt', 1324, '72baa7b2a977ee05c5a338149cbab040b705ba4d532ebbf808b9f7b0d7b22529'],
  ['dep/brotli/LICENSE.txt', 1084, '3d180008e36922a4e8daec11c34c7af264fed5962d07924aea928c38e8663c94'],
  ['dep/certdata/LICENSE.url', 73, 'b9954f88a27e8457cefcebd076fa533d037711383f6b28ae489d063ef8c61f79'],
  ['dep/libpsl/COPYING.txt', 1126, 'e7c9f0d8498d28a360a7e8293ea70fd7bd952955b636938322c13d60a03b5a45'],
  ['dep/libressl/COPYING.txt', 6492, '9853507b8821c3f277aa60bf554eade41441ef06b2df538d247183ad28789b7f'],
  ['dep/libssh2/COPYING.txt', 1959, 'f7f9633cf9ff2f1333f3d7ce46973a8716a4d2a2815ad56f30d437d5fea7bafe'],
  ['dep/nghttp2/COPYING.txt', 1156, '6b94f3abc1aabd0c72a7c7d92a77f79dda7c8a0cb3df839a97890b4116a2de2a'],
  ['dep/nghttp3/COPYING.txt', 1081, '58cc3fc8c6d6cb2485ab35eb5918e849b5bf1e56522974e106d7a39a88d61dcd'],
  ['dep/ngtcp2/COPYING.txt', 1080, '542dd526d2ea23565f0571cc68df6f05ed11248a90ff0f32de19d8ba589db513'],
  ['dep/psl/LICENSE.txt', 16727, '66a3107d5ad6a058aab753eaac2047ccb2ed0e39465dd0fe5844da3e300d5172'],
  ['dep/zlibng/LICENSE.md', 867, '6c9f0d975b41afaa34d22f55bb8986ce69e5cb7ad327cb2b28820cd425edf5ee'],
  ['dep/zstd/LICENSE.txt', 1549, '7055266497633c9025b777c78eb7235af13922117480ed5c674677adc381c9d8'],
];

export function managedCurlCatalogFor(arch: Architecture): ManagedCurlCatalog {
  const arm = arch === 'arm64';
  const root = arm ? 'curl-8.21.0_7-win64a-mingw' : 'curl-8.21.0_7-win64-mingw';
  const hashes = arm
    ? { archive: 'ac666fcb35cd359056823b105d71f4ec59c1226a8b5642a85439810eba1a4d4b', exe: '697a7b03611fd218faf8375c5f28b990fddba68677995d3c51647d5a0b0dc55c', exeBytes: 3633768, machine: 0xaa64, build: '57702dcd9c3f2058fc258ddefee07aa3b99835d9608b98070af5a9271f0de53f', buildBytes: 12480, url: 'https://curl.se/windows/dl-8.21.0_7/curl-8.21.0_7-win64a-mingw.zip' }
    : { archive: 'e469dcdb219d0eca9236b01c7e4bb34fe04af3d4036d350829178dc60f241ae4', exe: 'd52793b2279d9226498dbadc00e524333fb64a996bda0ce621abe9a620f1188a', exeBytes: 3846248, machine: 0x8664, build: '61b8122435cc1d2adf60610f583db184056818154e61972dce635258c2dac866', buildBytes: 12476, url: 'https://curl.se/windows/dl-8.21.0_7/curl-8.21.0_7-win64-mingw.zip' };
  return {
    version: VERSION, arch, url: hashes.url, archiveSha256: hashes.archive, archiveRoot: root,
    files: [
      { archivePath: 'bin/curl.exe', installPath: 'bin/curl.exe', bytes: hashes.exeBytes, sha256: hashes.exe, peMachine: hashes.machine },
      { archivePath: 'bin/curl-ca-bundle.crt', installPath: 'bin/curl-ca-bundle.crt', bytes: 188900, sha256: CA_SHA },
      { archivePath: 'BUILD-HASHES.txt', installPath: 'licenses/BUILD-HASHES.txt', bytes: hashes.buildBytes, sha256: hashes.build },
      ...LICENSES.map(([archivePath, bytes, sha256]) => ({ archivePath, installPath: `licenses/${archivePath}`, bytes, sha256 })),
    ],
  };
}

const flights = new Map<string, Promise<ManagedCurlPreparation>>();
const MAX_ARCHIVE_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 8 * 1024 * 1024;

function hash(data: Uint8Array): string { return createHash('sha256').update(data).digest('hex'); }
function cancelled(signal?: AbortSignal): boolean { return signal?.aborted === true; }
function fail(errorCode: NonNullable<ManagedCurlPreparation['errorCode']>, error: string): ManagedCurlPreparation { return { dependency: 'managed-curl', status: 'failed', errorCode, error }; }

/** Narrow lexical recognition only; it deliberately is not a PowerShell parser. */
export function containsLiteralCurlExe(command: string): boolean {
  let quote: "'" | '"' | undefined;
  let token = '';
  const examine = () => { const matched = token.toLowerCase() === 'curl.exe'; token = ''; return matched; };
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (quote) {
      if (c === quote) {
        if (quote === "'" && command[i + 1] === "'") { i += 1; continue; }
        quote = undefined;
      } else if (quote === '"' && c === '`') i += 1;
      continue;
    }
    if (c === "'" || c === '"') { if (examine()) return true; quote = c; continue; }
    if (c === '#') { if (examine()) return true; while (i < command.length && command[i] !== '\n') i += 1; continue; }
    if (/\s|[;|&(){}\[\],]/.test(c)) { if (examine()) return true; continue; }
    token += c;
  }
  return examine();
}

function isInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function safeDirectory(directory: string, parent?: string): Promise<void> {
  if (parent && !isInside(parent, directory)) throw new Error('Managed curl path escapes its owner directory');
  try {
    const stats = await fs.lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('Managed curl path is not a real directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (parent) await safeDirectory(parent);
    await fs.mkdir(directory);
  }
}

async function ensureManagedRoot(vaultPath: string, configDir: string): Promise<string> {
  if (path.isAbsolute(configDir) || configDir.split(/[\\/]/).some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Vault configuration directory is not a safe relative path');
  }
  await safeDirectory(vaultPath);
  let current = vaultPath;
  for (const part of [...configDir.split(/[\\/]/), 'plugins', 'obsidian-agent', 'tools', 'curl']) {
    const next = path.join(current, part);
    await safeDirectory(next, current);
    current = next;
  }
  return current;
}

async function removeOwned(root: string, target: string): Promise<void> {
  if (!isInside(root, target)) throw new Error('Refusing to remove a path outside the managed curl root');
  const stats = await fs.lstat(target);
  if (stats.isSymbolicLink()) throw new Error('Refusing to remove a reparse point');
  await fs.rm(target, { recursive: stats.isDirectory(), force: true });
}

async function hasOnlyExpectedFiles(directory: string, expected: ReadonlySet<string>, relative = ''): Promise<boolean> {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const child = path.join(directory, childRelative);
    const stats = await fs.lstat(child);
    if (stats.isSymbolicLink()) return false;
    if (stats.isDirectory()) {
      if (!await hasOnlyExpectedFiles(directory, expected, childRelative)) return false;
    } else if (!stats.isFile() || !expected.has(childRelative.replace(/\\/g, '/'))) return false;
  }
  return true;
}

export function assertManagedCurlPeMachine(bytes: Uint8Array, expected: number): void {
  if (bytes.length < 64 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new Error('curl.exe is missing the DOS header');
  const offset = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0x3c, true);
  if (offset + 6 > bytes.length || bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x45 || bytes[offset + 2] !== 0 || bytes[offset + 3] !== 0) throw new Error('curl.exe is missing the PE signature');
  const machine = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset + 4, true);
  if (machine !== expected) throw new Error(`curl.exe PE Machine 0x${machine.toString(16)} does not match this architecture`);
}

export function validateManagedCurlZipNames(archive: Uint8Array, allowed: Set<string>): void {
  // Parse central-directory names before decompression so duplicate and unsafe
  // entries cannot be hidden by the ZIP object's key map.
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 0x10016); i -= 1) {
    if (archive[i] === 0x50 && archive[i + 1] === 0x4b && archive[i + 2] === 5 && archive[i + 3] === 6) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP end record is missing');
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const seen = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > archive.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP central directory is malformed');
    const nameBytes = view.getUint16(offset + 28, true);
    const extra = view.getUint16(offset + 30, true);
    const comment = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(archive.slice(offset + 46, offset + 46 + nameBytes));
    if (!name || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name) || name.split('/').includes('..')) throw new Error(`ZIP entry is unsafe: ${name}`);
    // curl.se's archive contains documentation and build artifacts we do not
    // install. Only allowlisted files are extracted; duplicates of a selected
    // file are rejected before fflate can collapse them into one object key.
    if (allowed.has(name)) {
      if (seen.has(name)) throw new Error(`ZIP has a duplicate managed entry: ${name}`);
      seen.add(name);
    }
    offset += 46 + nameBytes + extra + comment;
  }
  if (seen.size !== allowed.size) throw new Error('ZIP does not contain the complete managed curl allowlist');
}

export type ManagedCurlPaths = { binPath: string; caBundlePath: string };

export async function verifyManagedCurlInstallation(directory: string, catalog: ManagedCurlCatalog): Promise<ManagedCurlPaths | undefined> {
  try {
    const stats = await fs.lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return undefined;
    const expectedPaths = new Set([...catalog.files.map((file) => file.installPath), 'install-manifest.json']);
    if (!await hasOnlyExpectedFiles(directory, expectedPaths)) return undefined;
    for (const spec of catalog.files) {
      const target = path.join(directory, spec.installPath);
      if (!isInside(directory, target)) return undefined;
      const file = await fs.readFile(target);
      if (file.length !== spec.bytes || hash(file) !== spec.sha256) return undefined;
      if (spec.peMachine) assertManagedCurlPeMachine(file, spec.peMachine);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'install-manifest.json'), 'utf8')) as { version?: string; arch?: string; archiveSha256?: string };
    if (manifest.version !== catalog.version || manifest.arch !== catalog.arch || manifest.archiveSha256 !== catalog.archiveSha256) return undefined;
    const binPath = path.join(directory, 'bin');
    return { binPath, caBundlePath: path.join(binPath, 'curl-ca-bundle.crt') };
  } catch { return undefined; }
}

async function cleanupOwnedStaging(root: string): Promise<void> {
  const stagingRoot = path.join(root, '.staging');
  try {
    const entries = await fs.readdir(stagingRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!/^oa-[0-9a-f-]{36}$/i.test(entry.name)) continue;
      const target = path.join(stagingRoot, entry.name);
      try { await removeOwned(root, target); } catch { /* never follow or broaden cleanup after a filesystem race */ }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function installManagedCurlArchive(root: string, catalog: ManagedCurlCatalog, response: ManagedCurlDownload, signal?: AbortSignal): Promise<ManagedCurlPreparation> {
  if (cancelled(signal)) return fail('cancelled', 'Managed curl preparation was cancelled; the command was not executed');
  const archive = new Uint8Array(response.arrayBuffer);
  if (response.status < 200 || response.status >= 300 || archive.byteLength > MAX_ARCHIVE_BYTES) return fail('download', 'Managed curl download was invalid or too large; the command was not executed');
  if (hash(archive) !== catalog.archiveSha256) return fail('archive-hash', 'Managed curl archive hash verification failed; the command was not executed');

  const expectedEntries = new Map(catalog.files.map((file) => [`${catalog.archiveRoot}/${file.archivePath}`, file]));
  let files: Record<string, Uint8Array>;
  try {
    validateManagedCurlZipNames(archive, new Set(expectedEntries.keys()));
    files = unzipSync(archive, { filter: (file) => expectedEntries.has(file.name) });
  }
  catch (error) { return fail('allowlist', `Managed curl archive allowlist verification failed; the command was not executed: ${error instanceof Error ? error.message : String(error)}`); }
  if (Object.values(files).reduce((total, file) => total + file.byteLength, 0) > MAX_EXTRACTED_BYTES) return fail('allowlist', 'Managed curl archive expands beyond the allowed size; the command was not executed');

  const stagingRoot = path.join(root, '.staging');
  const staging = path.join(stagingRoot, `oa-${randomUUID()}`);
  try {
    await safeDirectory(stagingRoot, root);
    await fs.mkdir(staging);
    for (const [archivePath, spec] of expectedEntries) {
      if (cancelled(signal)) throw new Error('cancelled');
      const bytes = files[archivePath];
      if (!bytes || bytes.byteLength !== spec.bytes || hash(bytes) !== spec.sha256) throw new Error(`file-hash:${spec.installPath}`);
      if (spec.peMachine) assertManagedCurlPeMachine(bytes, spec.peMachine);
      const target = path.join(staging, spec.installPath);
      if (!isInside(staging, target)) throw new Error('allowlist path escapes staging');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    }
    const manifest = JSON.stringify({ version: catalog.version, arch: catalog.arch, archiveSha256: catalog.archiveSha256, files: catalog.files.map(({ installPath, bytes, sha256 }) => ({ installPath, bytes, sha256 })) }, null, 2);
    await fs.writeFile(path.join(staging, 'install-manifest.json'), `${manifest}\n`, 'utf8');
    if (!await verifyManagedCurlInstallation(staging, catalog)) throw new Error('file-hash:staging verification');
    if (cancelled(signal)) throw new Error('cancelled');
    const finalDirectory = path.join(root, catalog.version, catalog.arch);
    const existing = await verifyManagedCurlInstallation(finalDirectory, catalog);
    if (existing) { await removeOwned(root, staging); return { dependency: 'managed-curl', status: 'ready', ...existing }; }
    try { await fs.lstat(finalDirectory); await safeDirectory(path.dirname(finalDirectory), root); await fs.rename(finalDirectory, path.join(root, `.broken-${randomUUID()}`)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await safeDirectory(path.dirname(finalDirectory), root);
    try { await fs.rename(staging, finalDirectory); }
    catch (error) {
      const winner = await verifyManagedCurlInstallation(finalDirectory, catalog);
      if (winner) { await removeOwned(root, staging); return { dependency: 'managed-curl', status: 'ready', ...winner }; }
      throw error;
    }
    const paths = await verifyManagedCurlInstallation(finalDirectory, catalog);
    return paths ? { dependency: 'managed-curl', status: 'ready', ...paths } : fail('filesystem', 'Managed curl publish verification failed; the command was not executed');
  } catch (error) {
    try { await removeOwned(root, staging); } catch { /* staging cleanup is best effort and strictly contained */ }
    if (error instanceof Error && error.message === 'cancelled') return fail('cancelled', 'Managed curl preparation was cancelled; the command was not executed');
    if (error instanceof Error && error.message.startsWith('file-hash:')) return fail('file-hash', `Managed curl file verification failed; the command was not executed: ${error.message}`);
    if (error instanceof Error && /PE (Machine|signature)|DOS header/.test(error.message)) return fail('pe-arch', `Managed curl architecture verification failed; the command was not executed: ${error.message}`);
    return fail('filesystem', `Managed curl installation failed; the command was not executed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function prepareManagedCurlInstallation(params: { root: string; catalog: ManagedCurlCatalog; previous?: ManagedCurlCatalog; download: () => Promise<ManagedCurlDownload>; signal?: AbortSignal }): Promise<ManagedCurlPreparation> {
  const key = `${params.root}\0${params.catalog.version}\0${params.catalog.arch}`;
  const existingFlight = flights.get(key);
  if (existingFlight) return existingFlight;
  const flight = (async () => {
    try {
      await safeDirectory(params.root);
      await cleanupOwnedStaging(params.root);
      const current = await verifyManagedCurlInstallation(path.join(params.root, params.catalog.version, params.catalog.arch), params.catalog);
      if (current) return { dependency: 'managed-curl', status: 'ready', ...current } as ManagedCurlPreparation;
      if (cancelled(params.signal)) return fail('cancelled', 'Managed curl preparation was cancelled; the command was not executed');
      const fallback = async (failed: ManagedCurlPreparation): Promise<ManagedCurlPreparation> => {
        if (!params.previous) return failed;
        const paths = await verifyManagedCurlInstallation(path.join(params.root, params.previous.version, params.previous.arch), params.previous);
        return paths ? { dependency: 'managed-curl', status: 'fallback-old', ...paths, errorCode: failed.errorCode, error: failed.error } : failed;
      };
      let response: ManagedCurlDownload;
      try { response = await params.download(); }
      catch (error) { return fallback(fail('download', `Managed curl download failed; the command was not executed: ${error instanceof Error ? error.message : String(error)}`)); }
      if (cancelled(params.signal)) return fail('cancelled', 'Managed curl preparation was cancelled; the command was not executed');
      return fallback(await installManagedCurlArchive(params.root, params.catalog, response, params.signal));
    } catch (error) { return fail('filesystem', `Managed curl path validation failed; the command was not executed: ${error instanceof Error ? error.message : String(error)}`); }
  })().finally(() => flights.delete(key));
  flights.set(key, flight);
  return flight;
}

export async function prepareWindowsManagedCurl(params: { command: string; vaultPath: string; configDir: string; signal?: AbortSignal }): Promise<ManagedCurlPreparation> {
  if (process.platform !== 'win32' || !containsLiteralCurlExe(params.command)) return { dependency: 'managed-curl', status: 'not-needed' };
  const arch: Architecture | undefined = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : undefined;
  if (!arch) return fail('filesystem', `Managed curl is unavailable for Windows architecture ${process.arch}; the command was not executed`);
  if (!params.vaultPath || !path.isAbsolute(params.vaultPath)) return fail('filesystem', 'Managed curl requires the Vault filesystem path; the command was not executed');
  const catalog = managedCurlCatalogFor(arch);
  const unsafeRoot = path.join(params.vaultPath, params.configDir, 'plugins', 'obsidian-agent', 'tools', 'curl');
  const root = path.resolve(unsafeRoot);
  if (!isInside(path.resolve(params.vaultPath), root)) return fail('filesystem', 'Managed curl path escapes the Vault; the command was not executed');
  try { await ensureManagedRoot(path.resolve(params.vaultPath), params.configDir); }
  catch (error) { return fail('filesystem', `Managed curl path validation failed; the command was not executed: ${error instanceof Error ? error.message : String(error)}`); }
  return prepareManagedCurlInstallation({
    root, catalog, signal: params.signal,
    download: async () => {
      const response = await requestUrl({ url: catalog.url, method: 'GET' });
      return { status: response.status, arrayBuffer: response.arrayBuffer };
    },
  });
}
