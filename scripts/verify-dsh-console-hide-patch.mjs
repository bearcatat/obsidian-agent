import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dshPackage = '@deepseek-ai/dsh-sandbox-windows-acl';
const dshVersion = '0.1.0-rc.8';
const patchPackageVersion = '8.0.1';
const patchRelativePath = 'patches/@deepseek-ai+dsh-sandbox-windows-acl+0.1.0-rc.8.patch';
const dshRoot = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl');
const chunkRelativePath = 'lib/types-CNjZgO4h.js';

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function segmentBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `Could not locate the DSH ${label} spawn path`);
  return source.slice(start, end);
}

function extractCallArguments(source, start) {
  const open = source.indexOf('(', start);
  assert(open >= 0, 'Could not find CreateProcessAsUserW call opening parenthesis');

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index).split(',').map((argument) => argument.trim());
    }
  }
  throw new Error('Could not find CreateProcessAsUserW call closing parenthesis');
}

function verifySpawnPath(segment, label, expectedCreationFlags, expectedStdio) {
  const startupEncodes = [...segment.matchAll(/encodeStartupInfo\(startupInfo,\s*\{([\s\S]*?)\}\);/g)];
  assert(startupEncodes.length === 1, `DSH ${label} path must encode exactly one STARTUPINFOW`);

  const startupInfo = startupEncodes[0][1];
  for (const [field, value] of Object.entries({ cb: '104', dwFlags: '257', wShowWindow: '0', ...expectedStdio })) {
    assert(new RegExp(`\\b${field}:\\s*${value}(?:,|\\s|$)`).test(startupInfo), `DSH ${label} startup info must keep ${field} = ${value}`);
  }

  const callMatches = [...segment.matchAll(/api\.createProcessAsUserW\(/g)];
  assert(callMatches.length === 1, `DSH ${label} path must have exactly one CreateProcessAsUserW call`);
  const argumentsList = extractCallArguments(segment, callMatches[0].index);
  assert(argumentsList.length === 11, `DSH ${label} CreateProcessAsUserW call has an unexpected argument count`);
  assert(argumentsList[5] === '1', `DSH ${label} CreateProcessAsUserW must continue inheriting standard handles`);
  assert(argumentsList[6] === String(expectedCreationFlags), `DSH ${label} dwCreationFlags must remain ${expectedCreationFlags}`);
  assert(argumentsList[9] === 'startupInfo' && argumentsList[10] === 'processInfo', `DSH ${label} CreateProcessAsUserW must use its encoded STARTUPINFOW`);
  assert(!/CREATE_NO_WINDOW|CREATE_NEW_CONSOLE/.test(argumentsList[6]), `DSH ${label} CreateProcessAsUserW must not use console-isolation flags`);
}

function verifyInstalledPatch() {
  const packageJson = JSON.parse(read('package.json'));
  assert(packageJson.dependencies?.[dshPackage] === dshVersion, `package.json must pin ${dshPackage}@${dshVersion}`);
  assert(packageJson.devDependencies?.['patch-package'] === patchPackageVersion, `package.json must pin patch-package@${patchPackageVersion}`);
  assert(packageJson.scripts?.postinstall === 'patch-package --error-on-fail', 'postinstall must fail closed with patch-package --error-on-fail');

  const packageLock = JSON.parse(read('package-lock.json'));
  assert(packageLock.lockfileVersion === 3, 'package-lock.json must remain lockfileVersion 3');
  assert(packageLock.packages?.['']?.dependencies?.[dshPackage] === dshVersion, `package-lock.json root must pin ${dshPackage}@${dshVersion}`);
  assert(packageLock.packages?.['']?.devDependencies?.['patch-package'] === patchPackageVersion, `package-lock.json root must pin patch-package@${patchPackageVersion}`);
  assert(packageLock.packages?.['node_modules/@deepseek-ai/dsh-sandbox-windows-acl']?.version === dshVersion, `package-lock.json must lock ${dshPackage}@${dshVersion}`);
  assert(packageLock.packages?.['node_modules/patch-package']?.version === patchPackageVersion, `package-lock.json must lock patch-package@${patchPackageVersion}`);

  const patch = read(patchRelativePath);
  for (const expectedFile of [
    'lib/types-CNjZgO4h.js',
    'lib/types/spawn.d.ts',
    'lib/types/win32-abi.d.ts',
  ]) {
    assert(patch.includes(`a/node_modules/@deepseek-ai/dsh-sandbox-windows-acl/${expectedFile}`), `DSH patch must cover ${expectedFile}`);
  }
  assert((patch.match(/dwFlags: 257/g) ?? []).length === 2, 'DSH patch must set startup flags to 257 in both spawn paths');
  assert((patch.match(/wShowWindow: 0/g) ?? []).length === 2, 'DSH patch must set SW_HIDE in both spawn paths');
  assert(patch.includes('STARTF_USESHOWWINDOW') && patch.includes('SW_HIDE'), 'DSH patch must document the startup show-state constants');

  const installedPackage = JSON.parse(readFileSync(path.join(dshRoot, 'package.json'), 'utf8'));
  assert(installedPackage.version === dshVersion, `Installed ${dshPackage} must be ${dshVersion}`);
  const chunk = readFileSync(path.join(dshRoot, chunkRelativePath), 'utf8');
  const abi = readFileSync(path.join(dshRoot, 'lib/types/win32-abi.d.ts'), 'utf8');
  const spawnTypes = readFileSync(path.join(dshRoot, 'lib/types/spawn.d.ts'), 'utf8');

  assert(/dwFlags: "uint32",\s*wShowWindow: "uint16",\s*cbReserved2: "uint16"/.test(chunk), 'DSH STARTUPINFOW ABI field order must remain unchanged');
  assert(chunk.includes('STARTUPINFOW.size !== 104'), 'DSH STARTUPINFOW ABI size assertion must remain 104');
  assert(abi.includes('export declare const STARTF_USESHOWWINDOW = 1;') && abi.includes('export declare const SW_HIDE = 0;'), 'DSH ABI declarations must include STARTF_USESHOWWINDOW and SW_HIDE');
  assert(spawnTypes.includes('STARTF_USESHOWWINDOW with SW_HIDE') && spawnTypes.includes('CREATE_NO_WINDOW or CREATE_NEW_CONSOLE'), 'DSH spawn declarations must document the non-isolating show-state change');

  const pipe = segmentBetween(chunk, 'function spawnSandboxed(api, token, options) {', 'function drainPipe(api, handle) {', 'pipe');
  const runner = segmentBetween(chunk, 'function spawnSandboxedInherited(api, token, options) {', '//#endregion\n//#region lib/types/token.js', 'runner');
  verifySpawnPath(pipe, 'pipe', 0, { hStdInput: 'stdIn\\.read', hStdOutput: 'stdOut\\.write', hStdError: 'stdErr\\.write' });
  verifySpawnPath(runner, 'runner', 4, { hStdInput: 'stdIn', hStdOutput: 'stdOut', hStdError: 'stdErr' });
}

function verifyBundle() {
  const bundlePath = path.join(root, 'main.js');
  assert(existsSync(bundlePath), 'Production bundle main.js is required for --bundle verification');
  const bundle = readFileSync(bundlePath, 'utf8');
  const startupInfos = [...bundle.matchAll(/dwFlags:\s*257\s*,\s*wShowWindow:\s*0/g)];
  assert(startupInfos.length === 2, 'Production bundle must contain two hidden STARTUPINFOW encodes');

  const callMatches = [...bundle.matchAll(/\.createProcessAsUserW\(/g)];
  assert(callMatches.length === 2, 'Production bundle must contain both DSH CreateProcessAsUserW calls');
  const creationFlags = callMatches.map((match) => {
    const argumentsList = extractCallArguments(bundle, match.index);
    assert(argumentsList.length === 11, 'Production bundle CreateProcessAsUserW call has an unexpected argument count');
    assert(argumentsList[5] === '1', 'Production bundle CreateProcessAsUserW must continue inheriting standard handles');
    assert(!/CREATE_NO_WINDOW|CREATE_NEW_CONSOLE/.test(argumentsList[6]), 'Production bundle CreateProcessAsUserW must not use console-isolation flags');
    return argumentsList[6];
  }).sort();
  assert(creationFlags.join(',') === '0,4', 'Production bundle must preserve DSH pipe/runner dwCreationFlags 0/4');
}

verifyInstalledPatch();
if (process.argv.includes('--bundle')) verifyBundle();

console.log(`DSH console-hide patch verified: pipe/runner startup flags=257, show state=0, creation flags=0/4${process.argv.includes('--bundle') ? ', bundle verified' : ''}`);
