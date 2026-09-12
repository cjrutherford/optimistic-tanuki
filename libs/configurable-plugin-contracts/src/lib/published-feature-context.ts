/**
 * Safe context passed from a committed public app configuration to a lazy
 * feature. This contract intentionally contains no owner, workspace, or
 * release internals.
 */
export interface PublishedFeatureContext {
  /** The capability explicitly published for this feature. */
  capabilityId: string;
  /** The only product record handle a public feature may receive. */
  resourceRef: { type: string; id: string } | null;
  permissions: readonly string[];
  access: 'public' | 'access-required';
  settings: Readonly<Record<string, unknown>>;
  /** Canonical public domain resolved from the committed app snapshot. */
  domain: string | null;
}
