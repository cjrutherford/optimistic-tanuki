import {
  applyPriming,
  describePriming,
  resolvePrimingStrategy,
} from './model-priming';

/**
 * The strategies encode measurements, not preferences — see
 * `tools/scripts/pilot-onboarding-models.mjs --structured`. These tests pin the
 * distinctions that cost real debugging time to find.
 */
describe('model priming', () => {
  it('sends nothing extra to models that honour the schema', () => {
    for (const model of ['granite4:tiny-h', 'qwen3:8b']) {
      expect(resolvePrimingStrategy(model)).toBe('none');
    }
  });

  it('separates qwen3.5 from qwen3', () => {
    // The version that broke the interview: 3.5 ignores `format`, 3 does not.
    // A single /qwen/ rule would have primed both the same and hidden it.
    expect(resolvePrimingStrategy('qwen3.5:4b-q8_0')).toBe('instruction');
    expect(resolvePrimingStrategy('qwen3:8b')).toBe('none');
  });

  it('gives nemotron the prefill it needs', () => {
    // Instruction alone only reached 2/3 for this family.
    expect(resolvePrimingStrategy('nemotron-3-nano:4b-q8_0')).toBe('prefill');
  });

  it('primes an unmeasured model rather than assuming it behaves', () => {
    expect(resolvePrimingStrategy('some-new-model:9b')).toBe('instruction');
    expect(resolvePrimingStrategy('')).toBe('instruction');
  });

  it('says why a model is primed the way it is', () => {
    expect(describePriming('qwen3.5:4b-q8_0')).toContain('0/3 bare');
    expect(describePriming('mystery:1b')).toContain('no measurement');
  });

  describe('applying a strategy', () => {
    const schema = {
      properties: {
        question: { type: 'string' },
        dimension: { type: 'string' },
      },
    };

    it('leaves the prompt alone for "none"', () => {
      const out = applyPriming('none', 'base', schema);

      expect(out.system).toBe('base');
      expect(out.prefill).toBeNull();
    });

    it('names the required keys for "instruction"', () => {
      const out = applyPriming('instruction', 'base', schema);

      expect(out.system).toContain('question, dimension');
      expect(out.prefill).toBeNull();
    });

    it('seeds an opening brace for "prefill"', () => {
      const out = applyPriming('prefill', 'base', schema);

      expect(out.prefill).toBe('{');
      expect(out.system).toContain('question, dimension');
    });

    it('does nothing without a schema to describe', () => {
      const out = applyPriming('instruction', 'base', undefined);

      expect(out.system).toBe('base');
      expect(out.prefill).toBeNull();
    });
  });
});
