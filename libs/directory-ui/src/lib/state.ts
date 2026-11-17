import type { LocalDirectoryCoverage } from './models';
import { describeCoverage } from './coverage';

export type DirectoryStatus = 'loading' | 'failed' | 'ready';

export type DirectoryStateKind =
  | 'loading'
  | 'failed'
  | 'available'
  | 'empty'
  | 'acquiring'
  | 'partial'
  | 'blocked-town-ineligible'
  | 'blocked-policy-withdrawn'
  | 'unknown'
  | 'unconfigured'
  | 'no-match';

export interface DirectoryStateView {
  kind: DirectoryStateKind;
  /** Empty when the state needs no panel of its own (listings are simply shown). */
  title: string;
  message: string;
  withheldNote: string | null;
}

export interface DirectoryStateInput {
  status: DirectoryStatus;
  coverage?: LocalDirectoryCoverage | null;
  listingsShown: number;
  filtersActive: boolean;
}

/**
 * One place that decides what the directory says for a town. A failed request is never a coverage state, and
 * listings are never hidden by it. Copy for coverage states comes from `describeCoverage`.
 */
export function describeDirectoryState(
  input: DirectoryStateInput
): DirectoryStateView {
  if (input.status === 'loading') {
    return {
      kind: 'loading',
      title: 'Loading businesses…',
      message: '',
      withheldNote: null,
    };
  }
  if (input.status === 'failed') {
    return {
      kind: 'failed',
      title: 'Business directory is temporarily unavailable',
      message: 'Please try again.',
      withheldNote: null,
    };
  }
  const view = describeCoverage(
    input.coverage,
    input.listingsShown,
    input.filtersActive
  );
  const kind: DirectoryStateKind =
    view.kind === 'none'
      ? 'available'
      : view.kind === 'blocked'
      ? input.coverage?.reason === 'policy-withdrawn'
        ? 'blocked-policy-withdrawn'
        : 'blocked-town-ineligible'
      : view.kind;
  return {
    kind,
    title: view.title,
    message: view.message,
    withheldNote: view.withheldNote,
  };
}

/** `restaurant_bar` -> `Restaurant Bar`. */
export function humanizeCategory(category: string): string {
  return category
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const DIRECTORY_LIMITATION_TEXT =
  'Town assignments are unverified and directory coverage may be incomplete.';
