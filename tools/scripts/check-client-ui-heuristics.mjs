#!/usr/bin/env node

import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const root = process.cwd();
const appsRoot = join(root, 'apps');
const libsRoot = join(root, 'libs');
const findings = [];

const args = process.argv.slice(2);
const failOnFindings = args.includes('--fail-on-findings');

function getFlagValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Flag ${name} requires a value.`);
    process.exit(2);
  }
  return value;
}

const allowlistPath = getFlagValue('--allowlist');
const writeAllowlistPath = getFlagValue('--write-allowlist');

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith('.scss') || entry.name.endsWith('.ts'))
    ) {
      // Skip spec/test files: they hold mock data and assertions, not
      // shipped component styles, and routinely embed literal hex values
      // as fixtures (e.g. theme-config test doubles) that are not UI code.
      if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.d.ts')) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

function selectorForOffset(content, offset) {
  const before = content.slice(0, offset);
  const lastOpen = before.lastIndexOf('{');
  const lastClose = before.lastIndexOf('}');

  if (lastOpen === -1 || lastClose > lastOpen) {
    return '';
  }

  // Strip block/line comments from the pre-selector slice so that punctuation
  // (like ';' or '{') inside comments cannot mis-locate the selector boundary.
  const beforeOpen = content
    .slice(0, lastOpen)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // Selector starts after the previous statement boundary: '}' or ';'.
  // Using only '}' (the prior behavior) mis-attributes the selector when
  // the file has leading comments or @import statements above :root.
  const lastSemi = beforeOpen.lastIndexOf(';');
  const lastCloseClean = beforeOpen.lastIndexOf('}');
  const boundary = Math.max(lastCloseClean, lastSemi);
  const selectorStart = boundary + 1;

  // Strip comments from the final selector text as well.
  const rawSelector = content
    .slice(selectorStart, lastOpen)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  return rawSelector.trim().replace(/\s+/g, ' ');
}

function insideRootBlock(content, offset) {
  return selectorForOffset(content, offset)
    .split(',')
    .some((selector) => {
      const trimmed = selector.trim();
      // :root or [data-theme*=...] blocks are theming declarations,
      // not consumers. Hex literals there set tokens, which is allowed.
      return trimmed === ':root' || /^\[data-theme[*~|^$]?=/.test(trimmed);
    });
}

function isTokenFile(filePath) {
  const normalized = filePath.split(sep).join('/');
  return /(?:token|theme|personality)/i.test(normalized);
}

// Extracts the CSS text (and its absolute offset in `content`) of every
// template-literal entry inside an Angular `styles: [...]` array, or a bare
// `styles: \`...\`` string. This is deliberately narrow: we only want to
// look at inline component stylesheets, not arbitrary `.ts` source (route
// configs, comments, other string literals that happen to contain
// hex-looking substrings, etc).
function extractInlineStyleBlocks(content) {
  const blocks = [];
  const stylesKeyPattern = /\bstyles\s*:\s*/g;
  let keyMatch;

  while ((keyMatch = stylesKeyPattern.exec(content))) {
    let i = stylesKeyPattern.lastIndex;

    if (content[i] === '[') {
      // Array form: `styles: [ \`...\`, \`...\` ]`.
      // Walk bracket depth to find the matching close, but skip over the
      // contents of any template literal while doing so -- CSS attribute
      // selectors like `[data-theme]` contain brackets that would otherwise
      // desync the depth count.
      let depth = 0;
      let j = i;
      for (; j < content.length; j++) {
        const ch = content[j];
        if (ch === '`') {
          j++;
          while (j < content.length && content[j] !== '`') {
            if (content[j] === '\\') j++;
            j++;
          }
          continue;
        }
        if (ch === '[') {
          depth++;
        } else if (ch === ']') {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }

      const arrayText = content.slice(i, j);
      const templatePattern = /`([\s\S]*?)`/g;
      let templateMatch;
      while ((templateMatch = templatePattern.exec(arrayText))) {
        blocks.push({
          text: templateMatch[1],
          offset: i + templateMatch.index + 1,
        });
      }

      stylesKeyPattern.lastIndex = j;
    } else if (content[i] === '`') {
      // Bare template-literal form: `styles: \`...\``.
      let j = i + 1;
      while (j < content.length && content[j] !== '`') {
        if (content[j] === '\\') j++;
        j++;
      }
      blocks.push({ text: content.slice(i + 1, j), offset: i + 1 });
      stylesKeyPattern.lastIndex = j + 1;
    }
  }

  return blocks;
}

function addFinding(filePath, line, rule, message) {
  findings.push({
    file: relative(root, filePath).split(sep).join('/'),
    line,
    rule,
    message,
  });
}

// Buckets a finding's repo-relative path to the app or lib that owns it.
// Apps are bucketed by name (matching the pre-existing scheme); libs are
// bucketed under a `libs/<lib-name>` key so they're distinguishable from
// apps of the same short name and so the allowlist stays self-describing.
function appNameFor(relPath) {
  // relPath uses forward slashes (normalized in addFinding)
  const appMatch = relPath.match(/^apps\/([^/]+)\//);
  if (appMatch) return appMatch[1];

  const libMatch = relPath.match(/^libs\/([^/]+)\//);
  if (libMatch) return `libs/${libMatch[1]}`;

  return null;
}

if (!statSync(appsRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('apps/ directory not found');
  process.exit(1);
}

const hasLibsRoot = statSync(libsRoot, {
  throwIfNoEntry: false,
})?.isDirectory();
const scanRoots = hasLibsRoot ? [appsRoot, libsRoot] : [appsRoot];

for (const scanRoot of scanRoots) {
  for (const filePath of walk(scanRoot)) {
    const content = readFileSync(filePath, 'utf8');
    const isTsFile = filePath.endsWith('.ts');

    if (!isTokenFile(filePath)) {
      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;

      if (isTsFile) {
        // Only scan inside inline Angular component styles, not arbitrary
        // `.ts` source -- avoids false positives from hex-looking strings
        // in comments, route configs, mock/test fixtures, etc.
        for (const block of extractInlineStyleBlocks(content)) {
          let match;
          hexPattern.lastIndex = 0;
          while ((match = hexPattern.exec(block.text))) {
            if (!insideRootBlock(block.text, match.index)) {
              addFinding(
                filePath,
                lineNumberForOffset(content, block.offset + match.index),
                'hex-literal',
                `Replace ${match[0]} with a theme token or semantic variable.`
              );
            }
          }
        }
      } else {
        let match;
        while ((match = hexPattern.exec(content))) {
          if (!insideRootBlock(content, match.index)) {
            addFinding(
              filePath,
              lineNumberForOffset(content, match.index),
              'hex-literal',
              `Replace ${match[0]} with a theme token or semantic variable.`
            );
          }
        }
      }
    }

    // The remaining heuristics (narrow-layout, badge-fixed-color) are
    // scoped to real stylesheets; inline `.ts` template strings aren't
    // scanned for these today.
    if (isTsFile) {
      continue;
    }

    const maxWidthPattern = /max-width\s*:\s*(\d+(?:\.\d+)?)px\b/g;
    let maxWidthMatch;
    while ((maxWidthMatch = maxWidthPattern.exec(content))) {
      const selector = selectorForOffset(content, maxWidthMatch.index);
      const value = Number(maxWidthMatch[1]);
      if (value < 1280 && /(?:shell|layout)/i.test(selector)) {
        addFinding(
          filePath,
          lineNumberForOffset(content, maxWidthMatch.index),
          'narrow-layout',
          `Selector "${selector}" uses max-width ${value}px; top-level shell/layout containers should stay >= 1280px unless intentionally narrow.`
        );
      }
    }

    const badgeColorPattern = /color\s*:\s*(white|black)\b/gi;
    let colorMatch;
    while ((colorMatch = badgeColorPattern.exec(content))) {
      const selector = selectorForOffset(content, colorMatch.index);
      if (/(?:badge|chip|pill)/i.test(selector)) {
        addFinding(
          filePath,
          lineNumberForOffset(content, colorMatch.index),
          'badge-fixed-color',
          `Selector "${selector}" uses color: ${colorMatch[1]}; use a semantic badge foreground token.`
        );
      }
    }
  }
}

// Deterministic ordering: file (asc), line (asc), rule (asc).
findings.sort((a, b) => {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
});

function countsByApp(items) {
  const counts = {};
  for (const item of items) {
    const app = appNameFor(item.file);
    if (!app) continue;
    counts[app] = (counts[app] ?? 0) + 1;
  }
  return counts;
}

const perApp = countsByApp(findings);

// --write-allowlist: snapshot current per-app counts and exit 0.
// Preserves explicit 0-budget entries from the existing file so that
// "pinned to 0" apps don't silently disappear when they have no findings.
if (writeAllowlistPath) {
  const fullPath = join(root, writeAllowlistPath);
  let existingApps = {};
  try {
    existingApps = JSON.parse(readFileSync(fullPath, 'utf8'))?.apps ?? {};
  } catch {
    // First run; no existing file.
  }
  const snapshot = {
    generated: new Date().toISOString().slice(0, 10),
    apps: {},
  };
  const allApps = new Set([
    ...Object.keys(existingApps),
    ...Object.keys(perApp),
  ]);
  for (const app of [...allApps].sort()) {
    snapshot.apps[app] = perApp[app] ?? 0;
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote allowlist snapshot for ${allApps.size} app/lib bucket(s) to ${writeAllowlistPath}.`
  );
  process.exit(0);
}

// --allowlist: compare per-app counts to budgets; exit 1 if any app exceeds.
if (allowlistPath) {
  let allowlist;
  try {
    allowlist = JSON.parse(readFileSync(join(root, allowlistPath), 'utf8'));
  } catch (err) {
    console.error(
      `Failed to read allowlist at ${allowlistPath}: ${err.message}`
    );
    process.exit(2);
  }
  const budgets = allowlist?.apps ?? {};
  const allApps = new Set([...Object.keys(budgets), ...Object.keys(perApp)]);
  const overBudget = [];
  const underBudget = [];

  for (const app of [...allApps].sort()) {
    const actual = perApp[app] ?? 0;
    const budget = budgets[app] ?? 0;
    if (actual > budget) {
      overBudget.push({ app, actual, budget });
    } else if (actual < budget) {
      underBudget.push({ app, actual, budget });
    }
  }

  if (overBudget.length === 0) {
    console.log(
      `Client UI heuristic allowlist check passed (${findings.length} total findings).`
    );
    if (underBudget.length > 0) {
      console.log(
        'The following apps are below their allowlist budget; please lower them in tools/scripts/ui-heuristics-allowlist.json:'
      );
      for (const { app, actual, budget } of underBudget) {
        console.log(
          `  ${app}: ${actual} (budget ${budget}, -${budget - actual})`
        );
      }
    }
    process.exit(0);
  }

  console.error(
    `Client UI heuristic allowlist check FAILED for ${overBudget.length} app(s):`
  );
  for (const { app, actual, budget } of overBudget) {
    console.error(
      `  ${app}: ${actual} findings (budget ${budget}, +${actual - budget})`
    );
    for (const finding of findings.filter((f) => appNameFor(f.file) === app)) {
      console.error(
        `    ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`
      );
    }
  }
  console.error(
    '\nIf these violations are intentional, update tools/scripts/ui-heuristics-allowlist.json (see tools/scripts/README.md).'
  );
  process.exit(1);
}

if (findings.length > 0) {
  const output = failOnFindings ? console.error : console.warn;
  output(`Client UI heuristic check found ${findings.length} issue(s):`);
  for (const finding of findings) {
    output(
      `${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`
    );
  }

  if (failOnFindings) {
    process.exit(1);
  }

  console.log('Run with --fail-on-findings to enforce this check in CI.');
  process.exit(0);
}

console.log('Client UI heuristic check passed.');
