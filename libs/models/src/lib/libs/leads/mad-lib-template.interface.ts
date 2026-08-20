import { OnboardingProfileSuggestions } from './user-onboarding-profile.interface';

/**
 * The intro step used to be a single textarea whose mad-lib scaffold lived in
 * the placeholder — so it vanished the moment anyone typed, and the backend was
 * left regex-mining free prose for fields the user could have filled in
 * directly.
 *
 * A template renders the scaffold as real, always-visible prose with editable
 * slots, and every slot maps to exactly one onboarding field so what the user
 * types arrives structured instead of needing to be recovered.
 */

/** Field names a slot may bind to. */
export type MadLibField = keyof OnboardingProfileSuggestions;

export type MadLibSlotKind =
  /** One short free-text value, e.g. the service offer. */
  | 'inline'
  /** One value chosen from `options`, e.g. geographic focus. */
  | 'choice'
  /** Several values entered as bullets/chips, e.g. industries. */
  | 'list';

export interface MadLibTextSegment {
  kind: 'text';
  /** Literal connective prose, rendered as-is. */
  text: string;
}

export interface MadLibSlotSegment {
  kind: 'slot';
  field: MadLibField;
  slotType: MadLibSlotKind;
  /** Shown when the slot is empty. */
  placeholder: string;
  /** Short label for assistive technology and the field summary. */
  label: string;
  /** Selectable values; required for `choice`, optional suggestions for `list`. */
  options?: string[];
  /** Slots the sentence reads acceptably without. */
  optional?: boolean;
}

export type MadLibSegment = MadLibTextSegment | MadLibSlotSegment;

export interface MadLibTemplate {
  id: string;
  segments: MadLibSegment[];
}

/**
 * What the composer emits: the readable sentence for `madLibSummary`, plus the
 * slot values keyed by onboarding field.
 */
export interface MadLibComposition {
  /** The composed sentence, with filled slot values inlined. */
  sentence: string;
  /** Explicit values the user supplied, keyed by onboarding field. */
  values: OnboardingProfileSuggestions;
  /** Fields the user left blank — the only ones worth asking a model to infer. */
  unfilledFields: MadLibField[];
}

export interface MadLibAnalysisRequest {
  /** Free prose, from the composed sentence or the paragraph escape hatch. */
  text: string;
  /** Present when the structured composer was used. */
  composition?: MadLibComposition;
}
