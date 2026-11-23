/**
 * The confirmation ladder.
 *
 * - `plain`: reversible actions. One click.
 * - `reason`: actions that affect users. A reason is required and returned.
 * - `typed`: bulk or irreversible actions. The exact phrase must be typed.
 */
export type OwnerConfirmLevel = 'plain' | 'reason' | 'typed';

export interface OwnerConfirmOptions {
  level: OwnerConfirmLevel;
  title: string;
  body: string;
  confirmLabel: string;
  /** Required when `level` is `typed`. Matched exactly, case included. */
  typedPhrase?: string;
  /** Styles the confirm button as dangerous. */
  destructive?: boolean;
}

export interface OwnerConfirmResult {
  confirmed: boolean;
  /** Present when `level` is `reason` and the action was confirmed. */
  reason?: string;
}
