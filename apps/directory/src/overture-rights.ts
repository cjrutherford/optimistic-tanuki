/** Field-lineage evaluation only. A supplied policy must come from a trusted
 * approval authority; this module does not establish or persist approval. */
export const OVERTURE_RIGHTS_POLICY_VERSION = 'overture-rights-target-v1';
export const OVERTURE_RIGHTS_FIELDS = {
  name: { pointer: '/properties/names/primary', required: true },
  basic_category: { pointer: '/basic_category', required: true },
  primary: { pointer: '/taxonomy/primary', required: true },
  hierarchy: { pointer: '/taxonomy/hierarchy', required: true },
  alternate: { pointer: '/taxonomy/alternates', required: false },
  geometry: { pointer: '/geometry', required: true },
  address: { pointer: '/properties/addresses', required: false },
  phone: { pointer: '/properties/phones', required: false },
  website: { pointer: '/properties/websites', required: false },
  // The upstream record id. Retained only as a keyed hash for cross-release identity; never required.
  id: { pointer: '/id', required: false },
} as const;

/**
 * The rights map as it stood before `id` was added. Existing approved policies and scan ids were derived from
 * this exact list, so every script that re-derives one of them must use it. Only a new, id-inclusive policy
 * uses the full OVERTURE_RIGHTS_FIELDS. Never edit this list.
 */
export const OVERTURE_RIGHTS_FIELDS_LEGACY_V1: readonly (keyof typeof OVERTURE_RIGHTS_FIELDS)[] =
  Object.freeze([
    'name',
    'basic_category',
    'primary',
    'hierarchy',
    'alternate',
    'geometry',
    'address',
    'phone',
    'website',
  ]) as readonly (keyof typeof OVERTURE_RIGHTS_FIELDS)[];

export type OvertureRightsOperation =
  | 'ingest'
  | 'retain'
  | 'privateDisplay'
  | 'publicDisplay'
  | 'export'
  | 'enrich';
export interface OvertureRightsSource {
  readonly property?: unknown;
  readonly dataset?: unknown;
  readonly license?: unknown;
  readonly provider?: unknown;
  readonly record_id?: unknown;
  readonly resource?: unknown;
  readonly version?: unknown;
}
export interface OvertureRightsTerm {
  readonly dataset: string;
  readonly license: string;
  readonly attribution: string;
  readonly termsUrl: string;
  readonly notice?: string;
  readonly permissions: Partial<
    Readonly<
      Record<
        OvertureRightsOperation,
        readonly (keyof typeof OVERTURE_RIGHTS_FIELDS)[]
      >
    >
  >;
}
/** No policies are bundled: each operation and source mapping requires explicit approval. */
export interface OvertureRightsPolicy {
  readonly releaseId: string;
  readonly operations: Partial<
    Readonly<Record<OvertureRightsOperation, boolean>>
  >;
  readonly terms: readonly OvertureRightsTerm[];
}
export interface OvertureFieldRightsDecision {
  readonly pointer: string;
  readonly status: 'eligible' | 'review' | 'omitted';
  readonly reviewRequired: boolean;
  readonly impact: 'none' | 'omit_field' | 'quarantine_record';
  readonly reasons: readonly (
    | 'operation_not_approved'
    | 'missing_source_terms'
    | 'unmapped_source_terms'
    | 'ambiguous_source_pointer'
  )[];
  readonly attributions: readonly string[];
  readonly termsUrls: readonly string[];
  readonly notices: readonly string[];
  readonly sources: readonly OvertureRightsSource[];
}
export interface OvertureRightsEvaluation {
  readonly policyVersion: typeof OVERTURE_RIGHTS_POLICY_VERSION;
  readonly eligible: boolean;
  readonly reviewRequired: boolean;
  readonly fields: Readonly<Record<string, OvertureFieldRightsDecision>>;
}
const operations: readonly string[] = [
  'ingest',
  'retain',
  'privateDisplay',
  'publicDisplay',
  'export',
  'enrich',
];
const validPointer = (p: unknown): p is string =>
  typeof p === 'string' &&
  (p === '' || (p.startsWith('/') && !/~(?![01])/u.test(p)));
const overlaps = (a: string, b: string): boolean =>
  a === '' || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const unique = (values: string[]): string[] => [...new Set(values)];
const httpsUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export function evaluateOvertureFieldRights(
  row: {
    readonly releaseId?: string;
    readonly sources?: readonly OvertureRightsSource[];
  },
  operation: OvertureRightsOperation,
  policy?: OvertureRightsPolicy
): OvertureRightsEvaluation {
  const raw: unknown = row?.sources;
  const sources = Array.isArray(raw) ? raw : [];
  const terms = Array.isArray(policy?.terms) ? policy.terms : [];
  const malformed =
    !Array.isArray(raw) ||
    Array.from(sources).some(
      (s: unknown) =>
        !s ||
        typeof s !== 'object' ||
        Array.isArray(s) ||
        ((s as OvertureRightsSource).property !== undefined &&
          !validPointer((s as OvertureRightsSource).property))
    );
  const approved =
    typeof row?.releaseId === 'string' &&
    row.releaseId.length > 0 &&
    policy?.releaseId === row.releaseId &&
    operations.includes(operation) &&
    !!policy?.operations &&
    Object.prototype.hasOwnProperty.call(policy.operations, operation) &&
    policy.operations[operation] === true &&
    Array.isArray(policy?.terms);
  const fields: Record<string, OvertureFieldRightsDecision> = {};
  for (const [name, config] of Object.entries(OVERTURE_RIGHTS_FIELDS)) {
    const relevant: OvertureRightsSource[] = malformed
      ? []
      : sources.filter((s: OvertureRightsSource) =>
          overlaps(
            typeof s.property === 'string' ? s.property : '',
            config.pointer
          )
        );
    const mappings: OvertureRightsTerm[] = [];
    for (const source of relevant) {
      const matches = terms.filter(
        (t) => t && t.dataset === source.dataset && t.license === source.license
      );
      const term = matches.length === 1 ? matches[0] : undefined;
      if (
        term &&
        typeof term.dataset === 'string' &&
        typeof term.license === 'string' &&
        typeof term.attribution === 'string' &&
        term.attribution.trim() &&
        httpsUrl(term.termsUrl) &&
        !!term.permissions &&
        Object.prototype.hasOwnProperty.call(term.permissions, operation) &&
        Array.isArray(term.permissions[operation]) &&
        Array.from({ length: term.permissions[operation]!.length }, (_, i) =>
          Object.prototype.hasOwnProperty.call(term.permissions[operation], i)
        ).every(Boolean) &&
        term.permissions[operation]?.includes(
          name as keyof typeof OVERTURE_RIGHTS_FIELDS
        ) &&
        (term.notice === undefined ||
          (typeof term.notice === 'string' && term.notice.trim()))
      )
        mappings.push(term);
    }
    const reason = malformed
      ? 'ambiguous_source_pointer'
      : !approved
      ? 'operation_not_approved'
      : !relevant.length
      ? 'missing_source_terms'
      : mappings.length !== relevant.length
      ? 'unmapped_source_terms'
      : undefined;
    fields[name] = {
      pointer: config.pointer,
      status: reason ? (config.required ? 'review' : 'omitted') : 'eligible',
      reviewRequired: !!reason,
      impact: reason
        ? config.required
          ? 'quarantine_record'
          : 'omit_field'
        : 'none',
      reasons: reason ? [reason] : [],
      sources: relevant,
      attributions: reason ? [] : unique(mappings.map((m) => m.attribution)),
      termsUrls: reason ? [] : unique(mappings.map((m) => m.termsUrl)),
      notices: reason
        ? []
        : unique(mappings.flatMap((m) => (m.notice ? [m.notice] : []))),
    };
  }
  return {
    policyVersion: OVERTURE_RIGHTS_POLICY_VERSION,
    eligible: Object.entries(OVERTURE_RIGHTS_FIELDS).every(
      ([name, config]) => !config.required || fields[name].status === 'eligible'
    ),
    reviewRequired: Object.values(fields).some((f) => f.reviewRequired),
    fields,
  };
}
