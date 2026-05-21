import { HttpErrorResponse } from '@angular/common/http';

import { isAbortLikeHttpError } from './http-error.utils';

describe('isAbortLikeHttpError', () => {
  it('returns true for Angular HttpErrorResponse aborts', () => {
    expect(
      isAbortLikeHttpError(
        new HttpErrorResponse({
          status: 0,
          statusText: 'Unknown Error',
        })
      )
    ).toBe(true);
  });

  it('returns true for DOM abort errors', () => {
    expect(isAbortLikeHttpError(new DOMException('Aborted', 'AbortError'))).toBe(
      true
    );
  });

  it('returns true for abort-like plain objects', () => {
    expect(
      isAbortLikeHttpError({
        name: 'CanceledError',
        message: 'Request canceled while navigating away',
      })
    ).toBe(true);
  });

  it('returns true for nested abort-like transport errors', () => {
    expect(
      isAbortLikeHttpError({
        message: 'Http failure response',
        error: {
          message: 'net::ERR_ABORTED',
        },
      })
    ).toBe(true);
  });

  it('returns false for real application errors', () => {
    expect(
      isAbortLikeHttpError(
        new HttpErrorResponse({
          status: 500,
          statusText: 'Server Error',
        })
      )
    ).toBe(false);
  });
});
