import { HttpErrorResponse } from '@angular/common/http';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function hasAbortLikeName(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    ['AbortError', 'CanceledError', 'CancelledError'].includes(value)
  );
}

function hasAbortLikeMessage(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /(aborted|aborterror|canceled|cancelled|ERR_ABORTED)/i.test(value)
  );
}

export function isAbortLikeHttpError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  const record = asRecord(error);
  if (!record) {
    return false;
  }

  if (record['status'] === 0) {
    return true;
  }

  if (hasAbortLikeName(record['name']) || hasAbortLikeMessage(record['message'])) {
    return true;
  }

  const nestedError = record['error'];
  const nestedRecord = asRecord(nestedError);
  if (!nestedRecord) {
    return false;
  }

  return (
    nestedRecord['status'] === 0 ||
    hasAbortLikeName(nestedRecord['name']) ||
    hasAbortLikeMessage(nestedRecord['message'])
  );
}
