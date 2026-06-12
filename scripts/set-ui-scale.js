import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CONFIG_PATH = path.join(root, 'config', 'ui-scale.json');
const CSS_PATH = path.join(root, 'src', 'index.css');
const HTML_PATH = path.join(root, 'index.html');

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function parseScaleInput(raw) {
  const value = Number(String(raw).replace(/%$/, '').trim());
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid scale value: "${raw}"`);
  }
  return value > 1 ? value / 100 : value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatScale(value) {
  return Number(value.toFixed(4)).toString();
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function syncSources(config) {
  const defaultScale = formatScale(config.defaultScale);
  const minScale = formatScale(config.minScale);
  const maxScale = formatScale(config.maxScale);

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const nextCss = css.replace(
    /(--ui-scale:\s*)[\d.]+;/,
    `$1${defaultScale};`,
  );
  if (nextCss === css) {
    throw new Error('Could not update --ui-scale in src/index.css');
  }
  fs.writeFileSync(CSS_PATH, nextCss);

  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const nextHtml = html
    .replace(
      /if \(!isFinite\(scale\)\) scale = [\d.]+;/,
      `if (!isFinite(scale)) scale = ${defaultScale};`,
    )
    .replace(
      /scale = Math\.min\([\d.]+, Math\.max\([\d.]+, scale\)\);/,
      `scale = Math.min(${maxScale}, Math.max(${minScale}, scale));`,
    );
  if (nextHtml === html) {
    throw new Error('Could not update ui-scale bootstrap script in index.html');
  }
  fs.writeFileSync(HTML_PATH, nextHtml);
}

function printConfig(config) {
  console.log('UI scale settings');
  console.log(`  default: ${formatPercent(config.defaultScale)} (${formatScale(config.defaultScale)})`);
  console.log(`  min:     ${formatPercent(config.minScale)} (${formatScale(config.minScale)})`);
  console.log(`  max:     ${formatPercent(config.maxScale)} (${formatScale(config.maxScale)})`);
  console.log(`  step:    ${formatPercent(config.step)} (${formatScale(config.step)})`);
  console.log('');
  console.log(`Config: ${path.relative(root, CONFIG_PATH)}`);
}

function printUsage() {
  console.log(`Usage:
  node scripts/set-ui-scale.js <percent-or-decimal>
  node scripts/set-ui-scale.js --default 80
  node scripts/set-ui-scale.js --min 60 --max 100 --default 85
  node scripts/set-ui-scale.js show

Examples:
  node scripts/set-ui-scale.js 75
  node scripts/set-ui-scale.js 0.75
  node scripts/set-ui-scale.js --default 90

Notes:
  - Values above 1 are treated as percentages (75 => 75%).
  - Default is clamped between min and max (currently 60%-100%).
  - Restart dev server or refresh the app after changing the default.
  - Users can still override scale in Profile; clear localStorage key "khonofy_ui_scale" to use the new default.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === 'show' || arg === '--show') {
      options.show = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--default' || arg === '-d') {
      options.defaultScale = parseScaleInput(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--min') {
      options.minScale = parseScaleInput(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--max') {
      options.maxScale = parseScaleInput(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--step') {
      options.step = parseScaleInput(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.defaultScale != null) {
      throw new Error(`Unexpected extra value: ${arg}`);
    }

    options.defaultScale = parseScaleInput(arg);
  }

  return options;
}

function main() {
  let options;

  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  const config = readConfig();

  if (options.show) {
    printConfig(config);
    return;
  }

  if (options.defaultScale == null && options.minScale == null && options.maxScale == null && options.step == null) {
    printUsage();
    process.exit(1);
  }

  const next = { ...config };

  if (options.minScale != null) next.minScale = options.minScale;
  if (options.maxScale != null) next.maxScale = options.maxScale;
  if (options.step != null) next.step = options.step;

  if (next.minScale >= next.maxScale) {
    throw new Error('minScale must be less than maxScale');
  }

  if (options.defaultScale != null) {
    next.defaultScale = clamp(options.defaultScale, next.minScale, next.maxScale);
  } else {
    next.defaultScale = clamp(next.defaultScale, next.minScale, next.maxScale);
  }

  writeConfig(next);
  syncSources(next);

  console.log('Updated app UI scale defaults.');
  printConfig(next);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
