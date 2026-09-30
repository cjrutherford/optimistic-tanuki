const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_RE =
  /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+(?:\.[A-Za-z0-9\-_=]*)?/g;
const TOKEN_ASSIGN_RE =
  /(token|api[-_]?key|secret|password|authorization)\s*[:=]\s*['"]?[^\s'";,]+['"]?/gi;

/**
 * Redact PII/secrets before email + GitHub. Truncates overlong input.
 * Never throws — returns best-effort string.
 */
export function redact(input: string, maxLen = 2000): string {
  if (!input) return '';
  let out = String(input);
  if (out.length > maxLen) out = out.slice(0, maxLen) + '…[truncated]';
  out = out.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  out = out.replace(BEARER_RE, 'Bearer [REDACTED]');
  out = out.replace(TOKEN_ASSIGN_RE, '$1=[REDACTED]');
  return out;
}

export function redactLogs(logs: string[], maxLen = 2000): string[] {
  return (logs || []).slice(0, 200).map((l) => redact(l, maxLen));
}
