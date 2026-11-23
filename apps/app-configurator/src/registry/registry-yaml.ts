import { createHash } from 'crypto';
import { stringify } from 'yaml';
import type {
  AppRegistration,
  NavigationLink,
  RegistrySourceSnapshot,
} from '@optimistic-tanuki/app-registry-backend';

/**
 * The fields apps.yaml can express (see tools/registry). Anything else on an
 * app, such as `features` or `updatedAt`, is ignored when comparing the YAML
 * with the database and when exporting, so it never reads as drift.
 */
const YAML_APP_FIELDS = [
  'appId',
  'name',
  'domain',
  'subdomain',
  'uiBaseUrl',
  'apiBaseUrl',
  'appType',
  'visibility',
  'authEmail',
  'description',
  'iconUrl',
  'sortOrder',
] as const;

export function normalizeApp(app: AppRegistration): Record<string, unknown> {
  const source = app as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of YAML_APP_FIELDS) {
    const value = source[field];
    if (value !== undefined && value !== null && value !== '') {
      out[field] = value;
    }
  }
  return out;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function comparable(snapshot: RegistrySourceSnapshot): unknown {
  return {
    version: snapshot.registry.version,
    apps: [...snapshot.registry.apps]
      .map(normalizeApp)
      .sort((a, b) => String(a['appId']).localeCompare(String(b['appId']))),
    links: [...(snapshot.links ?? [])].sort((a: NavigationLink, b) =>
      a.linkId.localeCompare(b.linkId)
    ),
  };
}

/** Hash of everything that matters in a registry, ignoring timestamps. */
export function hashSnapshot(snapshot: RegistrySourceSnapshot): string {
  return createHash('sha256')
    .update(canonicalStringify(comparable(snapshot)))
    .digest('hex');
}

export function snapshotsEqual(
  left: RegistrySourceSnapshot,
  right: RegistrySourceSnapshot
): boolean {
  return (
    canonicalStringify(comparable(left)) ===
    canonicalStringify(comparable(right))
  );
}

/** apps.yaml text for a registry, in the order the Go tool writes it. */
export function toRegistryYaml(
  registry: RegistrySourceSnapshot['registry']
): string {
  return stringify(
    {
      version: registry.version,
      generatedAt: registry.generatedAt,
      apps: registry.apps.map(normalizeApp),
    },
    { lineWidth: 0 }
  );
}

/** Unified diff (3 lines of context) from `before` to `after`; '' if equal. */
export function unifiedDiff(
  before: string,
  after: string,
  beforeName = 'deployed/apps.yaml',
  afterName = 'database/apps.yaml'
): string {
  if (before === after) {
    return '';
  }
  const a = before.split('\n');
  const b = after.split('\n');
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  type Op = { tag: ' ' | '-' | '+'; text: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ tag: ' ', text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ tag: '-', text: a[i++] });
    } else {
      ops.push({ tag: '+', text: b[j++] });
    }
  }
  while (i < a.length) ops.push({ tag: '-', text: a[i++] });
  while (j < b.length) ops.push({ tag: '+', text: b[j++] });

  const context = 3;
  const changed = ops
    .map((op, index) => (op.tag === ' ' ? -1 : index))
    .filter((index) => index >= 0);
  const lines = [`--- ${beforeName}`, `+++ ${afterName}`];
  let cursor = 0;
  while (cursor < changed.length) {
    let end = cursor;
    while (
      end + 1 < changed.length &&
      changed[end + 1] - changed[end] <= context * 2 + 1
    ) {
      end++;
    }
    const start = Math.max(0, changed[cursor] - context);
    const stop = Math.min(ops.length - 1, changed[end] + context);
    const slice = ops.slice(start, stop + 1);
    const oldStart = ops.slice(0, start).filter((o) => o.tag !== '+').length;
    const newStart = ops.slice(0, start).filter((o) => o.tag !== '-').length;
    const oldCount = slice.filter((o) => o.tag !== '+').length;
    const newCount = slice.filter((o) => o.tag !== '-').length;
    lines.push(
      `@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`
    );
    slice.forEach((op) => lines.push(`${op.tag}${op.text}`));
    cursor = end + 1;
  }
  return lines.join('\n') + '\n';
}
