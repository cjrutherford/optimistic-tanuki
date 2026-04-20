import { HttpErrorResponse } from '@angular/common/http';

export function isAbortLikeHttpError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0;
}
