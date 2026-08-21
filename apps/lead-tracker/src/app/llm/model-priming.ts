/**
 * Per-model JSON priming.
 *
 * Ollama's `format` field is supposed to constrain decoding to a schema, and
 * for some models it does. For others it is quietly ignored and the reply comes
 * back as prose, which every caller here then discards — the user sees a
 * scripted fallback instead of a generated question.
 *
 * Rather than prime every model identically (needless tokens for the ones that
 * behave, and not enough for the ones that do not), each model declares what it
 * needs. Numbers below are schema-conformance out of 3 prompts, measured with:
 *
 *   node tools/scripts/pilot-onboarding-models.mjs --structured
 *
 * Re-run that after changing models and update the table; a guess here shows up
 * as a canned interview, not as an error.
 */

/** How much coaxing a model needs before it will emit a conforming object. */
export type PrimingStrategy =
  /** Honours `format` on its own. Send the prompt unchanged. */
  | 'none'
  /** Ignores `format` but complies when the contract is stated in the prompt. */
  | 'instruction'
  /** Needs the reply started for it, with an opening brace put in its mouth. */
  | 'prefill';

interface PrimingRule {
  /** Matched against the configured model name, case-insensitively. */
  pattern: RegExp;
  strategy: PrimingStrategy;
  /** What the pilot measured, so a future reader can tell fact from guess. */
  evidence: string;
}

/**
 * First match wins, so put specific models above family-wide patterns.
 */
const RULES: PrimingRule[] = [
  {
    pattern: /^granite/i,
    strategy: 'none',
    evidence: 'granite4:tiny-h 3/3 bare',
  },
  {
    // Qwen 3.5 ignores both the schema and legacy JSON mode; Qwen 3 does not.
    // Ordered ahead of the general qwen rule for that reason.
    pattern: /^qwen3\.5/i,
    strategy: 'instruction',
    evidence: 'qwen3.5:4b-q8_0 0/3 bare, 3/3 instruction',
  },
  {
    pattern: /^qwen3/i,
    strategy: 'none',
    evidence: 'qwen3:8b 3/3 bare',
  },
  {
    pattern: /^nemotron/i,
    strategy: 'prefill',
    evidence: 'nemotron-3-nano:4b-q8_0 0/3 bare, 2/3 instruction, 3/3 prefill',
  },
  {
    // The e2b QAT build fails every strategy; e4b is fine but too large for the
    // 8GB target. Instruction is the least-bad default for the family.
    pattern: /^gemma/i,
    strategy: 'instruction',
    evidence: 'gemma4:e2b-it-qat 0/3 in all modes — unsuitable; e4b conforms',
  },
  {
    pattern: /gpt-5-distill|gpt-oss|gpt-5\.2/i,
    strategy: 'none',
    evidence: 'GPT-distilled Qwen builds 3/3 bare',
  },
];

/**
 * Unknown models get the instruction treatment. It costs a couple of dozen
 * tokens and is harmless to a model that already conforms, whereas assuming
 * `none` for something untested fails silently.
 */
const DEFAULT_STRATEGY: PrimingStrategy = 'instruction';

export const resolvePrimingStrategy = (model: string): PrimingStrategy => {
  const name = (model || '').trim();
  if (!name) {
    return DEFAULT_STRATEGY;
  }

  return (
    RULES.find((rule) => rule.pattern.test(name))?.strategy ?? DEFAULT_STRATEGY
  );
};

/** The rule that matched, for logging why a model is being primed a given way. */
export const describePriming = (model: string): string => {
  const rule = RULES.find((candidate) => candidate.pattern.test(model || ''));
  return rule
    ? `${rule.strategy} (${rule.evidence})`
    : `${DEFAULT_STRATEGY} (no measurement for "${model}")`;
};

export interface PrimedPrompt {
  system: string;
  /** Seed text for an assistant turn, or null when none is needed. */
  prefill: string | null;
}

const contractLine = (keys: string[]) =>
  `Reply with a single JSON object and nothing else — no prose, no code fence, no explanation. It must contain exactly these keys: ${keys.join(
    ', '
  )}.`;

export const applyPriming = (
  strategy: PrimingStrategy,
  systemPrompt: string,
  schema: { properties?: Record<string, unknown> } | undefined
): PrimedPrompt => {
  const keys = Object.keys(schema?.properties || {});
  if (!schema || !keys.length || strategy === 'none') {
    return { system: systemPrompt, prefill: null };
  }

  const system = `${systemPrompt}\n\n${contractLine(keys)}`;
  return {
    system,
    // An opening brace leaves the model nothing to continue but the object.
    prefill: strategy === 'prefill' ? '{' : null,
  };
};
