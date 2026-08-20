/**
 * A company the user specifically wants to work for, watched on its own ATS
 * board.
 *
 * Defined here rather than imported from `@optimistic-tanuki/leads-contracts`:
 * both libs are tagged `type:contracts`, and the workspace boundary rules
 * forbid one contracts lib depending on another. The two definitions are kept
 * structurally identical, the same way `LeadDiscoverySource` already is.
 */
export type AspirationalAtsProvider = 'greenhouse' | 'lever';

export interface AspirationalCompany {
  provider: AspirationalAtsProvider;
  /** The verified board token, e.g. `figma`. Never a guess. */
  token: string;
  /** What the user calls the company, for display. */
  label: string;
}
