import { HttpErrorResponse } from '@angular/common/http';

/**
 * What to tell someone when a request fails. The gateway's messages are
 * written for people, so they are shown as they are; validation failures
 * arrive as a list and are joined.
 */
export function problem(
  error: unknown,
  fallback = 'Something went wrong. Try again in a moment.'
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0)
    return 'The service could not be reached. Check your connection and try again.';
  if (error.status === 429)
    return 'Too many attempts from here. Wait a minute and try again.';
  const message = (error.error as { message?: unknown } | null)?.message;
  if (Array.isArray(message))
    return message.map(String).map(sentence).join(' ');
  if (typeof message === 'string' && message) return message;
  return fallback;
}

/** The error's machine-readable code, when the gateway gave one. */
export function problemCode(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) return undefined;
  const code = (error.error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  const capital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/u.test(capital) ? capital : `${capital}.`;
}
