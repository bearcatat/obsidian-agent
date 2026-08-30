import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';
import { zipSync } from 'fflate';

const root = process.cwd();
const source = readFileSync(path.join(root, 'src/tool/Bash/windows-managed-curl.ts'), 'utf8');
const prompt = readFileSync(path.join(root, 'src/tool/Bash/prompts.ts'), 'utf8');
const notices = readFileSync(path.join(root, 'src/tool/Bash/THIRD_PARTY_NOTICES.md'), 'utf8');
const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oa-managed-curl-fixture-'));
const bundlePath = path.join(fixtureDir, 'manager.cjs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failures = [];
async function check(name, callback) {
  try { await callback(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}
function pe(machine = 0x8664) {
  const bytes = new Uint8Array(96); bytes[0] = 0x4d; bytes[1] = 0x5a; bytes[0x3c] = 0x40;
  bytes.set([0x50, 0x45, 0, 0, machine & 0xff, machine >> 8], 0x40); return bytes;
}
function fixtureCatalog(files) {
  const archiveRoot = 'fixture-curl';
  const archive = zipSync(Object.fromEntries(files.map(({ archivePath, bytes }) => [`${archiveRoot}/${archivePath}`, bytes])));
  return { archive, catalog: { version: 'fixture-current', arch: 'x64', url: 'https://fixture.invalid/curl.zip', archiveSha256: sha(archive), archiveRoot,
    files: files.map(({ archivePath, installPath, bytes, peMachine }) => ({ archivePath, installPath, bytes: bytes.byteLength, sha256: sha(bytes), ...(peMachine ? { peMachine } : {}) })),
  } };
}

try {
  await esbuild.build({
    absWorkingDir: root, bundle: true, format: 'cjs', platform: 'node', target: 'node22', outfile: bundlePath,
    entryPoints: ['src/tool/Bash/windows-managed-curl.ts'], external: ['node:*'],
    plugins: [{ name: 'obsidian-fixture', setup(build) { build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export async function requestUrl() { throw new Error("network disabled in fixture"); }', loader: 'js' })); } }],
  });
  const managed = createRequire(import.meta.url)(bundlePath);
  const executable = pe(); const ca = new TextEncoder().encode('fixture-ca'); const license = new TextEncoder().encode('fixture-license');
  const baseFiles = [
    { archivePath: 'bin/curl.exe', installPath: 'bin/curl.exe', bytes: executable, peMachine: 0x8664 },
    { archivePath: 'bin/curl-ca-bundle.crt', installPath: 'bin/curl-ca-bundle.crt', bytes: ca },
    { archivePath: 'COPYING.txt', installPath: 'licenses/COPYING.txt', bytes: license },
  ];
  const { archive, catalog } = fixtureCatalog(baseFiles);

  await check('F1 fixed catalog and archive allowlist', async () => {
    for (const value of ['curl-8.21.0_7-win64-mingw.zip', 'curl-8.21.0_7-win64a-mingw.zip', 'e469dcdb219d0eca9236b01c7e4bb34fe04af3d4036d350829178dc60f241ae4', 'ac666fcb35cd359056823b105d71f4ec59c1226a8b5642a85439810eba1a4d4b']) assert.ok(source.includes(value), value);
    assert.equal(managed.managedCurlCatalogFor('x64').files.find((file) => file.installPath === 'bin/curl.exe').peMachine, 0x8664);
    assert.equal(managed.managedCurlCatalogFor('arm64').files.find((file) => file.installPath === 'bin/curl.exe').peMachine, 0xaa64);
    for (const arch of ['x64', 'arm64']) {
      const bundle = managed.managedCurlCatalogFor(arch).files.find((file) => file.installPath === 'bin/curl-ca-bundle.crt');
      assert.equal(bundle.bytes, 188900);
      assert.equal(bundle.sha256, '385ab0f472bd83b54421bee302f9b841bbac12310805fccf7debba16d84fafd0');
    }
    managed.assertManagedCurlPeMachine(executable, 0x8664);
    assert.throws(() => managed.assertManagedCurlPeMachine(pe(0xaa64), 0x8664));
  });

  await check('F1 local archive hash file hash PE allowlist license and manifest', async () => {
    const installRoot = path.join(fixtureDir, 'install');
    const result = await managed.installManagedCurlArchive(installRoot, catalog, { status: 200, arrayBuffer: archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) });
    assert.equal(result.status, 'ready');
    assert.equal(result.caBundlePath, path.join(installRoot, catalog.version, catalog.arch, 'bin', 'curl-ca-bundle.crt'));
    const installed = path.join(installRoot, catalog.version, catalog.arch);
    assert.ok(await managed.verifyManagedCurlInstallation(installed, catalog));
    assert.deepEqual((await fs.readdir(path.join(installed, 'bin'))).sort(), ['curl-ca-bundle.crt', 'curl.exe']);
    assert.equal(await fs.readFile(path.join(installed, 'licenses', 'COPYING.txt'), 'utf8'), 'fixture-license');
    assert.equal(JSON.parse(await fs.readFile(path.join(installed, 'install-manifest.json'), 'utf8')).files.length, 3);
  });

  await check('F1 malicious entries and mismatches fail closed', async () => {
    for (const name of ['../escape.txt', '/absolute.txt', 'C:/drive.txt', 'dir\\escape.txt']) {
      const bad = zipSync({ [`${catalog.archiveRoot}/bin/curl.exe`]: executable, [`${catalog.archiveRoot}/bin/curl-ca-bundle.crt`]: ca, [`${catalog.archiveRoot}/COPYING.txt`]: license, [name]: new Uint8Array([1]) });
      const result = await managed.installManagedCurlArchive(path.join(fixtureDir, `bad-${sha(new TextEncoder().encode(name)).slice(0, 8)}`), { ...catalog, archiveSha256: sha(bad) }, { status: 200, arrayBuffer: bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.byteLength) });
      assert.equal(result.errorCode, 'allowlist', name);
    }
    const hashResult = await managed.installManagedCurlArchive(path.join(fixtureDir, 'archive-hash'), { ...catalog, archiveSha256: '0'.repeat(64) }, { status: 200, arrayBuffer: archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) });
    assert.equal(hashResult.errorCode, 'archive-hash');
    const fileResult = await managed.installManagedCurlArchive(path.join(fixtureDir, 'file-hash'), { ...catalog, files: [{ ...catalog.files[0], sha256: '0'.repeat(64) }, ...catalog.files.slice(1)] }, { status: 200, arrayBuffer: archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) });
    assert.equal(fileResult.errorCode, 'file-hash');
    const bundleResult = await managed.installManagedCurlArchive(path.join(fixtureDir, 'bundle-hash'), { ...catalog, files: [catalog.files[0], { ...catalog.files[1], sha256: '0'.repeat(64) }, ...catalog.files.slice(2)] }, { status: 200, arrayBuffer: archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) });
    assert.equal(bundleResult.errorCode, 'file-hash');
  });

  await check('F2 manager install repair single-flight cancellation and cleanup', async () => {
    const managerRoot = path.join(fixtureDir, 'manager'); let downloads = 0;
    const response = { status: 200, arrayBuffer: archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) };
    const download = async () => { downloads += 1; await new Promise((resolve) => setTimeout(resolve, 10)); return response; };
    const [first, second] = await Promise.all([managed.prepareManagedCurlInstallation({ root: managerRoot, catalog, download }), managed.prepareManagedCurlInstallation({ root: managerRoot, catalog, download })]);
    assert.equal(first.status, 'ready'); assert.equal(second.status, 'ready'); assert.equal(downloads, 1);
    assert.equal(first.caBundlePath, path.join(managerRoot, catalog.version, catalog.arch, 'bin', 'curl-ca-bundle.crt'));
    assert.equal(second.caBundlePath, first.caBundlePath);
    const exe = path.join(managerRoot, catalog.version, catalog.arch, 'bin', 'curl.exe'); await fs.writeFile(exe, new Uint8Array([1, 2, 3]));
    assert.equal((await managed.prepareManagedCurlInstallation({ root: managerRoot, catalog, download })).status, 'ready'); assert.equal(downloads, 2);
    const stale = path.join(managerRoot, '.staging', 'oa-11111111-1111-1111-1111-111111111111'); await fs.mkdir(stale, { recursive: true });
    await managed.prepareManagedCurlInstallation({ root: managerRoot, catalog, download }); assert.equal(await fs.stat(stale).then(() => true, () => false), false);
    const currentBundle = path.join(managerRoot, catalog.version, catalog.arch, 'bin', 'curl-ca-bundle.crt');
    await fs.unlink(currentBundle);
    const repairedBundle = await managed.prepareManagedCurlInstallation({ root: managerRoot, catalog, download });
    assert.equal(repairedBundle.status, 'ready'); assert.equal(downloads, 3);
    assert.equal(repairedBundle.caBundlePath, currentBundle);
    const controller = new AbortController(); controller.abort();
    assert.equal((await managed.prepareManagedCurlInstallation({ root: path.join(fixtureDir, 'cancelled'), catalog, download, signal: controller.signal })).errorCode, 'cancelled');
    const fallbackRoot = path.join(fixtureDir, 'fallback'); const previous = { ...catalog, version: 'fixture-previous' };
    assert.equal((await managed.installManagedCurlArchive(fallbackRoot, previous, response)).status, 'ready');
    const fallback = await managed.prepareManagedCurlInstallation({ root: fallbackRoot, catalog, previous, download: async () => { throw new Error('fixture offline'); } });
    assert.equal(fallback.status, 'fallback-old');
    assert.ok(fallback.binPath.endsWith(path.join(previous.version, previous.arch, 'bin')));
    assert.equal(fallback.caBundlePath, path.join(fallbackRoot, previous.version, previous.arch, 'bin', 'curl-ca-bundle.crt'));
    await fs.unlink(fallback.caBundlePath);
    const missingBundleFallback = await managed.prepareManagedCurlInstallation({ root: fallbackRoot, catalog, previous, download: async () => { throw new Error('fixture offline'); } });
    assert.equal(missingBundleFallback.status, 'failed');
  });

  await check('F6 literal curl.exe token and Windows HTTP guidance', async () => {
    for (const command of ['curl.exe https://example.test', 'CURL.EXE -I https://example.test', 'Get-Date; curl.exe https://example.test']) assert.equal(managed.containsLiteralCurlExe(command), true, command);
    for (const command of ["'curl.exe'", '"curl.exe"', '# curl.exe', 'curl https://example.test', '& $cmd', "& ('cur' + 'l.exe')", 'C:\\Windows\\System32\\curl.exe -V', '-EncodedCommand Y3VybC5leGU=']) assert.equal(managed.containsLiteralCurlExe(command), false, command);
    for (const required of [
      'invoke curl.exe as the command and pass the URL as its argument',
      'curl.exe https://example.com',
      'A URL is data, never a PowerShell command',
      'never submit a bare http:// or https:// URL to Bash',
      'Always write curl.exe, never curl',
      'Do not default to -k or --insecure',
    ]) assert.ok(prompt.includes(required), required);
    assert.equal(/C:\\\\Windows\\System32\\curl\.exe/i.test(prompt), false, 'prompt must not prescribe the system curl');
    assert.ok(/do not fall back to the system curl\.exe/i.test(prompt), 'prompt must forbid system curl fallback');
    assert.ok(/Invoke-WebRequest or Invoke-RestMethod only when/i.test(prompt), 'Invoke cmdlets must remain exceptional rather than the ordinary HTTP path');
    assert.equal(source.includes('Invoke-WebRequest'), false, 'managed curl implementation must not fall back to Invoke-WebRequest');
    assert.equal(source.includes('Invoke-RestMethod'), false, 'managed curl implementation must not fall back to Invoke-RestMethod');
    assert.equal(source.includes('--insecure'), false, 'managed curl implementation must not inject insecure TLS');
    assert.ok(notices.includes('Managed Windows curl') && notices.includes('fflate'));
  });
} finally { await fs.rm(fixtureDir, { recursive: true, force: true }); }

console.log(`Managed curl fixture summary: ${failures.length ? `${failures.length} failed` : 'all passed'}`);
if (failures.length) process.exitCode = 1;
