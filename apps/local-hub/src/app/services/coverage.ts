import type {
  LocalDirectoryCoverage,
  LocalDirectoryCoverageReason,
  LocalDirectoryCoverageState,
} from '@optimistic-tanuki/social-contracts';

export type { LocalDirectoryCoverage };

const STATES: LocalDirectoryCoverageState[] = [
  'available',
  'empty',
  'acquiring',
  'partial',
  'blocked',
  'unknown',
];
const REASONS: LocalDirectoryCoverageReason[] = [
  'town-ineligible',
  'policy-withdrawn',
];

/** Keeps only a well-formed coverage object; anything else is treated as absent. */
export function readCoverage(
  value: unknown
): LocalDirectoryCoverage | undefined {
  const v = value as Partial<LocalDirectoryCoverage> | null;
  if (!v || typeof v !== 'object') return undefined;
  const count = v.withheldReviewedDetails;
  if (
    !STATES.includes(v.state as LocalDirectoryCoverageState) ||
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > 1_000_000
  )
    return undefined;
  if (v.state === 'blocked') {
    if (!REASONS.includes(v.reason as LocalDirectoryCoverageReason))
      return undefined;
  } else if (v.reason !== undefined) return undefined;
  return {
    state: v.state as LocalDirectoryCoverageState,
    ...(v.state === 'blocked'
      ? { reason: v.reason as LocalDirectoryCoverageReason }
      : {}),
    withheldReviewedDetails: count,
  };
}

export type CoverageViewKind =
  | 'none'
  | 'empty'
  | 'acquiring'
  | 'partial'
  | 'blocked'
  | 'unknown'
  | 'no-match';

export interface CoverageView {
  kind: CoverageViewKind;
  title: string;
  message: string;
  /** Non-blocking note shown alongside listings; null when nothing is withheld. */
  withheldNote: string | null;
}

export const WITHHELD_NOTE =
  "Some business details are hidden until they're re-checked.";

/**
 * Describes what a town's directory page should say. Listings are never hidden by
 * this: `kind` only says which message to show, and `none` means show nothing extra.
 * Never claims a town has no businesses unless coverage proved it.
 */
export function describeCoverage(
  coverage: LocalDirectoryCoverage | null | undefined,
  listingsShown: number,
  filtersActive: boolean
): CoverageView {
  const withheldNote =
    coverage && coverage.withheldReviewedDetails > 0 ? WITHHELD_NOTE : null;
  const view = (
    kind: CoverageViewKind,
    title: string,
    message: string
  ): CoverageView => ({ kind, title, message, withheldNote });

  if (coverage?.state === 'blocked') {
    return coverage.reason === 'policy-withdrawn'
      ? view(
          'blocked',
          'Listings withdrawn',
          'Business listings for this town have been withdrawn.'
        )
      : view(
          'blocked',
          'Directory not available',
          "The business directory isn't available for this town."
        );
  }
  if (coverage?.state === 'acquiring') {
    return view(
      'acquiring',
      'Gathering listings',
      'Business listings for this town are being gathered.'
    );
  }
  if (listingsShown === 0 && filtersActive) {
    return view(
      'no-match',
      'No results',
      'No businesses match your search. Try different words or clear the search.'
    );
  }
  if (coverage?.state === 'partial') {
    return view(
      'partial',
      'Listings still arriving',
      'More listings are still being gathered.'
    );
  }
  if (listingsShown > 0) return view('none', '', '');
  if (coverage?.state === 'empty') {
    return view(
      'empty',
      'No businesses listed',
      'No businesses are listed for this town yet.'
    );
  }
  if (coverage?.state === 'available') return view('none', '', '');
  return view(
    'unknown',
    'Coverage unknown',
    "We can't tell yet whether this town has listings."
  );
}
