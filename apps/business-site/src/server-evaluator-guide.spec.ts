import { isEvaluatorGuideEnabled } from './server-evaluator-guide';

describe('isEvaluatorGuideEnabled', () => {
  it('disables the evaluator guide in production', () => {
    expect(isEvaluatorGuideEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('enables the evaluator guide in development', () => {
    expect(isEvaluatorGuideEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('enables the evaluator guide when NODE_ENV is unset', () => {
    expect(isEvaluatorGuideEnabled({})).toBe(true);
  });

  it('enables the evaluator guide for any non-production value', () => {
    expect(isEvaluatorGuideEnabled({ NODE_ENV: 'staging' })).toBe(true);
    expect(isEvaluatorGuideEnabled({ NODE_ENV: 'test' })).toBe(true);
  });
});
