/**
 * Turn a failed request into the line an operator reads: what was being
 * attempted, then the server's reason when it gave one, else the status.
 * Pages show this instead of logging the raw error object, so a failure is
 * explained on screen rather than hidden in the console.
 */
export function describeHttpError(err: unknown, action: string): string {
  const reason = httpErrorReason(err);
  return reason ? `${action}: ${reason}` : action;
}

function httpErrorReason(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const failure = err as {
    status?: number;
    statusText?: string;
    message?: unknown;
    error?: unknown;
  };
  const body = failure.error;
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (typeof body === 'object' && body !== null) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
    if (Array.isArray(message) && message.length) return message.join('; ');
  }
  if (failure.status === 0) return 'the server could not be reached';
  if (typeof failure.status === 'number' && failure.status > 0) {
    return failure.statusText && failure.statusText !== 'OK'
      ? `${failure.status} ${failure.statusText}`
      : `status ${failure.status}`;
  }
  return typeof failure.message === 'string' && failure.message
    ? failure.message
    : undefined;
}
