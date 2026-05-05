import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import autoprefixer from 'autoprefixer';
import chokidar from 'chokidar';
import { transform } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const args = new Set(process.argv.slice(2));
const watchMode = args.has('--watch');
const minify = args.has('--minify');

const rootDir = process.cwd();
const inputPath = path.join(rootDir, 'src', 'styles.css');
const outputPath = path.join(rootDir, 'styles.css');
const watchPaths = ['src/**/*.{js,ts,jsx,tsx}', 'src/styles.css', 'tailwind.config.js'];

let isBuilding = false;
let pendingTrigger = null;
let rebuildTimer = null;

async function buildCss(trigger) {
  const input = await fs.readFile(inputPath, 'utf8');
  const result = await postcss([tailwindcss(), autoprefixer()]).process(input, {
    from: inputPath,
    to: outputPath,
  });

  let css = result.css;
  if (minify) {
    css = (await transform(css, { loader: 'css', minify: true })).code;
  }

  await fs.writeFile(outputPath, css);
  console.log(`[build:css] Wrote styles.css (${trigger})`);
}

async function flushBuildQueue() {
  if (isBuilding || pendingTrigger === null) {
    return;
  }

  const trigger = pendingTrigger;
  pendingTrigger = null;
  isBuilding = true;

  try {
    await buildCss(trigger);
  } catch (error) {
    console.error('[build:css] Build failed:', error);
    if (!watchMode) {
      process.exitCode = 1;
    }
  } finally {
    isBuilding = false;
    if (pendingTrigger !== null) {
      await flushBuildQueue();
    }
  }
}

function scheduleBuild(trigger) {
  pendingTrigger = trigger;
  if (rebuildTimer !== null) {
    clearTimeout(rebuildTimer);
  }
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void flushBuildQueue();
  }, 50);
}

if (watchMode) {
  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
  });

  watcher.on('all', (eventName, filePath) => {
    const relativePath = path.relative(rootDir, filePath);
    scheduleBuild(`${eventName} ${relativePath}`);
  });

  process.on('SIGINT', () => {
    void watcher.close().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void watcher.close().finally(() => process.exit(0));
  });

  scheduleBuild('initial build');
} else {
  scheduleBuild('build');
  await flushBuildQueue();
}
