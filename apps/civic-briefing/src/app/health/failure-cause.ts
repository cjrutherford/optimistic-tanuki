/**
 * What a pipeline or model failure comes down to, so the same underlying
 * problem is counted, alerted and digested once rather than once per run or
 * per town. Run errors are wrapped in retry prose ("Strict brief failed after
 * 2 model attempt(s): ...") and carry run-specific numbers, addresses and
 * paths; none of that distinguishes one cause from another.
 */
export interface FailureCause {
  /** Stable key: the same cause on another run or town gives the same key. */
  key: string;
  /** A short, readable name for an operator. */
  label: string;
  /** Whether this is the model service being unreachable rather than its output being rejected. */
  kind:
    | 'model-unavailable'
    | 'model-timeout'
    | 'grounding'
    | 'invalid-output'
    | 'pipeline';
}

const GROUNDING = /claim-grounding\/([a-z0-9-]+)/i;

/**
 * The model service never answered. Written in the subset of regex syntax
 * Postgres `~*` shares with JavaScript, so the dashboard's SQL trend counts
 * the same calls as unanswered.
 */
export const UNAVAILABLE_PATTERN =
  'request unavailable|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EAI_AGAIN|socket hang up';
export const TIMEOUT_PATTERN = 'request timeout|timed out';
const UNAVAILABLE = new RegExp(UNAVAILABLE_PATTERN, 'i');
const TIMEOUT = new RegExp(TIMEOUT_PATTERN, 'i');

export function failureCause(error: string | null | undefined): FailureCause {
  const message = (error ?? '').trim();
  if (!message)
    return { key: 'unknown', label: 'no error recorded', kind: 'pipeline' };
  if (UNAVAILABLE.test(message))
    return {
      key: 'model-unavailable',
      label: 'model service unreachable',
      kind: 'model-unavailable',
    };
  if (TIMEOUT.test(message))
    return {
      key: 'model-timeout',
      label: 'model request timed out',
      kind: 'model-timeout',
    };
  const grounding = GROUNDING.exec(message);
  if (grounding) {
    const rule = grounding[1].toLowerCase();
    return {
      key: `grounding:${rule}`,
      label: `rejected by grounding check: ${rule.replace(/-/g, ' ')}`,
      kind: 'grounding',
    };
  }
  if (/^Invalid \w+ output|Strict \w+ failed/i.test(message)) {
    return {
      key: `invalid:${normalise(
        message.replace(
          /^Strict \w+ failed after \d+ model attempt\(s\):\s*/i,
          ''
        )
      )}`,
      label: shorten(message),
      kind: 'invalid-output',
    };
  }
  return {
    key: `pipeline:${normalise(message)}`,
    label: shorten(message),
    kind: 'pipeline',
  };
}

/** Lower-cased, numbers, addresses and paths flattened, first clause only. */
function normalise(message: string): string {
  return message
    .split(/[:;]\s/)[0]
    .replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '<addr>')
    .replace(/\/[\w./-]+/g, '<path>')
    .replace(/\d+/g, 'N')
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

function shorten(message: string): string {
  return message.length > 140 ? `${message.slice(0, 137)}…` : message;
}
