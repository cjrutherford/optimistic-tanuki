/** Typed boundary shared by the strict Ollama client and its callers. */
// Re-export the persisted synthesis identity so LLM callers and the core
// runner use one contract version without duplicating a magic string.
export {
  STORY_SYNTHESIS_CONTRACT_VERSION,
  SYNTHESIS_CONTRACT_VERSION,
  storyInputSha256,
} from '@optimistic-tanuki/civic-core';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface LlmCitation {
  sourceKey: string;
  civicItemId: number;
  /** Exact derived agenda row identity; omitted for non-agenda evidence. */
  agendaItemId?: number;
  articleUrl?: string;
  snippetOnly?: boolean;
}

/**
 * The parent document is an authoritative context envelope for a derived
 * row (for example, an agenda item). It may establish the institution, event
 * type, and narrowly recognized meeting logistics (time/address) named by a
 * claim; it is deliberately not part of the row's factual body for arbitrary
 * dates, numbers, names, outcomes, or occurrence.
 */
export interface LlmDocumentContext {
  title?: string;
  body?: string;
}

/** One independently grounded factual sentence in a strict analysis. */
export interface LlmClaim {
  text: string;
  citations: LlmCitation[];
}

export type LlmOperation =
  | 'cluster'
  | 'brief'
  | 'brief_plan'
  | 'story'
  | 'agenda_fixup';

/** Transport classification only; it is never public editorial prose. */
export type LlmEvidenceKind = 'agenda-row' | 'source-item';

export interface LlmEvidence extends LlmCitation {
  /** Exact transport kind used to prevent parent-document leakage. */
  evidenceKind?: LlmEvidenceKind;
  title?: string;
  body?: string;
  date?: string;
  /** The source states no publication or event date, so dates in its text cannot be placed in time. */
  undated?: boolean;
  /**
   * News is dated since the last edition; background is earlier, dated
   * evidence from the same stories, which an article may use only with its
   * date, and never as what is new.
   */
  role?: 'news' | 'background';
  heading?: string;
  /** Citation-bound source metadata may provide local context omitted by a body excerpt. */
  localitySlug?: string;
  scopeSlug?: string;
  scopeKind?: string;
  sourceName?: string;
  publisher?: string | null;
  geographyDecision?: 'include' | 'withhold' | 'uncertain' | null;
  accessMode?: 'full' | 'snippet-only';
  /** Parent CivicItem context, restricted to role/event-type/logistics grounding. */
  parentDocumentContext?: LlmDocumentContext;
}

export interface LlmAnalysisProvenance {
  provider: 'ollama';
  baseUrl: string;
  model: string;
  promptSha256: string;
  inputSha256: string;
  outputSha256: string;
  generatedAt: string;
  latencyMs: number;
  attempt: number;
  fallbackUsed: boolean;
  sourceKeys: string[];
  runId?: string;
  operation?: LlmOperation;
  generationSettings?: LlmGenerationSettings;
}

/** Deterministic generation controls recorded with each model attempt. */
export interface LlmGenerationSettings {
  temperature?: number;
  seed?: number;
  numCtx?: number;
  /** Let a thinking model reason before answering; off unless set (evaluation only). */
  think?: boolean;
  /** Ceiling on generated tokens, so a repetition loop fails fast. */
  numPredict?: number;
  /** Ollama repeat_penalty; above 1 discourages a model repeating itself. */
  repeatPenalty?: number;
  /** How many recent tokens the repeat penalty looks back over (Ollama default 64). */
  repeatLastN?: number;
}

export interface LlmClusterAnalysis {
  headline: string;
  summary: string;
  whyItMatters: string;
  citations: LlmCitation[];
  limitation?: string;
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface LlmBriefBullet {
  text: string;
  citations: LlmCitation[];
  limitation?: string;
  /** The writer left this planned fact out; the plan's own sentence stands in, grounded like any claim. */
  fromPlan?: boolean;
}

/** A bullet or claim dropped because it failed validation; the rest of the output was kept. */
export interface LlmRejectedClaim {
  index: number;
  text: string;
  reason: string;
  /** The citations the model attached, as returned (for diagnosis). */
  citations?: unknown;
}

/** One paragraph of an edition's article: claims in order, each with its citations. */
export interface LlmArticleParagraph {
  claims: LlmBriefBullet[];
}

/** The editor's plan for a two-stage brief: what to report, in order. Internal; never published. */
export interface LlmBriefPlan {
  matters: {
    body: string;
    subject: string;
    facts: { text: string; citations: LlmCitation[] }[];
  }[];
}

export interface LlmBriefAnalysis {
  /** Every claim, flattened in reading order; kept for provenance and evaluation. */
  bullets: LlmBriefBullet[];
  /** The edition as an article: a headline and paragraphs, when the model wrote one. */
  headline?: string;
  /** Whether the headline is the model's or fell back to the lead evidence's own title. */
  headlineOrigin?: 'model' | 'claim' | 'plan' | 'evidence';
  paragraphs?: LlmArticleParagraph[];
  rejected?: LlmRejectedClaim[];
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface LlmStoryAnalysis {
  title: string;
  /** Whether the title was returned by the model or safely supplied by the evidence input. */
  titleOrigin: 'model' | 'evidence';
  /** Deterministically joined claim text. Strict live output must supply claims. */
  narrative: string;
  claims?: LlmClaim[];
  rejected?: LlmRejectedClaim[];
  status: 'decided' | 'pending' | 'ongoing';
  citations: LlmCitation[];
  limitation?: string;
  provenance: LlmAnalysisProvenance;
  relegated?: boolean;
}

export interface LlmAgendaItem {
  section: string;
  heading: string;
  body: string;
  citations: LlmCitation[];
}

export interface LlmAgendaAnalysis {
  items: LlmAgendaItem[];
  provenance: LlmAnalysisProvenance;
}

export interface LlmAttemptRecord {
  runId?: string;
  operation: LlmOperation;
  model: string;
  attempt: number;
  status: 'succeeded' | 'failed';
  promptSha256: string;
  inputSha256: string;
  outputSha256?: string;
  /** Canonical evidence identities used for this attempt. */
  sourceKeys: string[];
  /** Canonical model response text, when one was received. */
  output?: string;
  generatedAt: string;
  latencyMs: number;
  /** Transport diagnostics retained separately from canonical output. */
  raw?: unknown;
  error?: string;
  generationSettings?: LlmGenerationSettings;
}
