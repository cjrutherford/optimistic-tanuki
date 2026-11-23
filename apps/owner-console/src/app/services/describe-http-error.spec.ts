import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError } from './describe-http-error';

describe('describeHttpError', () => {
  it('prefers the message the server sent', () => {
    const err = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: { message: 'Forum is not configured' },
    });
    expect(describeHttpError(err, 'Failed to load forum topics')).toBe(
      'Failed to load forum topics: Forum is not configured'
    );
  });

  it('joins validation messages', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: ['name is required', 'price must be positive'] },
    });
    expect(describeHttpError(err, 'Failed to create product')).toBe(
      'Failed to create product: name is required; price must be positive'
    );
  });

  it('falls back to the status when the body says nothing', () => {
    const err = new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
    });
    expect(describeHttpError(err, 'Failed to load orders')).toBe(
      'Failed to load orders: 500 Internal Server Error'
    );
  });

  it('says when the server could not be reached', () => {
    const err = new HttpErrorResponse({ status: 0 });
    expect(describeHttpError(err, 'Failed to load orders')).toBe(
      'Failed to load orders: the server could not be reached'
    );
  });

  it('keeps the action alone for an unknown failure', () => {
    expect(describeHttpError(undefined, 'Failed to load orders')).toBe(
      'Failed to load orders'
    );
  });
});
