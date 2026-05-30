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

    if (entry.isFile() && entry.name.endsWith('.scss')) {
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

  // Selector starts after the previous statement boundary: '}' or ';'.
  // Using only '}' (the prior behavior) mis-attributes the selector when
  // the file has leading comments or @import statements above :root.
  const lastSemi = before.lastIndexOf(';', lastOpen - 1);
  const boundary = Math.max(lastClose, lastSemi);
  const selectorStart = boundary + 1;

  // Strip comments before trimming so they don't leak into selector text.
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

function addFinding(filePath, line, rule, message) {
  findings.push({
    file: relative(root, filePath).split(sep).join('/'),
    line,
    rule,
    message,
  });
}

function appNameFor(relPath) {
  // relPath uses forward slashes (normalized in addFinding)
  const match = relPath.match(/^apps\/([^/]+)\//);
  return match ? match[1] : null;
}

if (!statSync(appsRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('apps/ directory not found');
  process.exit(1);
}

for (const filePath of walk(appsRoot)) {
  const content = readFileSync(filePath, 'utf8');

  if (!isTokenFile(filePath)) {
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
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
    `Wrote allowlist snapshot for ${allApps.size} app(s) to ${writeAllowlistPath}.`
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
