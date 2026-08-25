import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expected = {
  'koffi-win32-x64.node': { bytes: 1_544_192, sha256: '2470bca8e26730762ca4b21ba15f233a45bf7f57bf2340826b9435843ea8cc14' },
  'koffi-win32-arm64.node': { bytes: 1_331_200, sha256: '74f6b141bb28d59acbc067878afc7bb266d0bf2d3f4d9b20107188243bce9979' },
};

for (const [name, metadata] of Object.entries(expected)) {
  const file = path.join(root, 'src', 'tool', 'Bash', 'koffi-payloads', name);
  if (!existsSync(file)) throw new Error(`Missing Koffi payload: ${name}`);
  const bytes = readFileSync(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== metadata.bytes || hash !== metadata.sha256) {
    throw new Error(`Koffi payload verification failed for ${name}: expected ${metadata.bytes}/${metadata.sha256}, got ${bytes.byteLength}/${hash}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.dependencies?.['@deepseek-ai/dsh-sandbox-windows-acl'] !== '0.1.0-rc.8'
  || packageJson.dependencies?.koffi !== '3.1.2'
  || packageJson.overrides?.koffi !== '3.1.2') {
  throw new Error('DSH/Koffi versions are not pinned to the approved exact values');
}

const packageLock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const lockedPackages = packageLock.packages ?? {};
for (const [packagePath, version] of Object.entries({
  'node_modules/@deepseek-ai/dsh-sandbox-windows-acl': '0.1.0-rc.8',
  'node_modules/koffi': '3.1.2',
  'node_modules/@koromix/koffi-win32-x64': '3.1.2',
  'node_modules/@koromix/koffi-win32-arm64': '3.1.2',
})) {
  if (lockedPackages[packagePath]?.version !== version) {
    throw new Error(`Package lock does not pin ${packagePath} to ${version}`);
  }
}

console.log('Koffi x64/ARM64 payload hashes and exact dependency pins verified');
