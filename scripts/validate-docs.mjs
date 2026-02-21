/**
 * validate-docs.mjs
 *
 * Checks that key facts in documentation match reality.
 * Run manually with `pnpm validate-docs` or automatically via git pre-commit hook.
 *
 * Checks:
 *   1. Version in package.json matches version in wxt.config.ts
 *   2. All scripts listed in scripts/README.md Quick Reference exist on disk
 *   3. Actual word count in topik-vocab.json is reflected in data/README.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let errors = [];
let warnings = [];

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); errors.push(msg); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); warnings.push(msg); }

// ─── 1. Version consistency ───────────────────────────────────────────────────
console.log('\n[1] Version consistency');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const pkgVersion = pkg.version;

const wxtConfig = fs.readFileSync(path.join(root, 'wxt.config.ts'), 'utf8');
const wxtMatch = wxtConfig.match(/version:\s*['"]([^'"]+)['"]/);
const wxtVersion = wxtMatch?.[1];

if (!wxtVersion) {
  fail('Could not find version field in wxt.config.ts');
} else if (pkgVersion !== wxtVersion) {
  fail(`Version mismatch: package.json=${pkgVersion}  wxt.config.ts=${wxtVersion}`);
} else {
  pass(`Both package.json and wxt.config.ts are at v${pkgVersion}`);
}

// ─── 2. Scripts listed in scripts/README.md exist on disk ────────────────────
console.log('\n[2] Script files exist on disk');

const scriptsReadme = fs.readFileSync(path.join(root, 'scripts', 'README.md'), 'utf8');

// Parse script filenames from the Quick Reference table rows: `| `filename` | ...`
const scriptMatches = [...scriptsReadme.matchAll(/^\| `([^`]+\.(js|mjs|py))`/gm)];
const listedScripts = [...new Set(scriptMatches.map(m => m[1]))];

for (const script of listedScripts) {
  const fullPath = path.join(root, 'scripts', script);
  if (fs.existsSync(fullPath)) {
    pass(`scripts/${script}`);
  } else {
    fail(`scripts/${script} is listed in scripts/README.md but does not exist`);
  }
}

if (listedScripts.length === 0) {
  warn('No script filenames found in scripts/README.md Quick Reference table — check table format');
}

// ─── 3. Word count in data/README.md matches topik-vocab.json ─────────────────
console.log('\n[3] Word count accuracy in data/README.md');

const vocabPath = path.join(root, 'src', 'assets', 'topik-vocab.json');
const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
const actualCount = vocab.length;

// Format with comma separator (e.g. 6065 → "6,065")
const formattedCount = actualCount.toLocaleString('en-US');

const dataReadme = fs.readFileSync(path.join(root, 'data', 'README.md'), 'utf8');

if (dataReadme.includes(formattedCount)) {
  pass(`data/README.md mentions actual word count (${formattedCount})`);
} else {
  fail(`data/README.md does not mention the actual word count. Expected to find "${formattedCount}" (actual: ${actualCount} words in topik-vocab.json)`);
}

// Also check DEVELOPMENT.md if it mentions a total word count
const devMd = fs.readFileSync(path.join(root, 'DEVELOPMENT.md'), 'utf8');
// Flag patterns that look like total counts: "X total words", "words (after", or "(X,XXX words)"
const devTotalMatches = [...devMd.matchAll(/(\d[\d,]+)\s*(?:total\s+)?words?(?:\s*\(after|\s+total|\))/gi)];
for (const m of devTotalMatches) {
  const raw = m[1].replace(/,/g, '');
  const n = parseInt(raw, 10);
  if (n > 1000 && n !== actualCount) {
    warn(`DEVELOPMENT.md mentions "${m[0].trim()}" but actual vocab count is ${formattedCount} — may need updating`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('');
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All doc checks passed.\n');
  process.exit(0);
} else {
  if (warnings.length > 0) {
    console.warn(`⚠️  ${warnings.length} warning(s) — review recommended but commit not blocked.\n`);
  }
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} error(s) — fix before committing.\n`);
    process.exit(1);
  }
  process.exit(0);
}
