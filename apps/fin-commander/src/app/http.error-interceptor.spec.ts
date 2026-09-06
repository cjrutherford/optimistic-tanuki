import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { firstValueFrom, of, throwError } from 'rxjs';
import { errorInterceptor } from './http.error-interceptor';

interface MessageServiceMock {
  addMessage: jest.Mock;
}

describe('errorInterceptor', () => {
  let messageService: MessageServiceMock;

  beforeEach(() => {
    messageService = { addMessage: jest.fn() };

    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: messageService }],
    });
  });

  async function runWithError(
    error: HttpErrorResponse
  ): Promise<HttpErrorResponse> {
    return TestBed.runInInjectionContext(async () => {
      const request = new HttpRequest('GET', '/api/finance/accounts');
      const next: HttpHandlerFn = () =>
        throwError(() => error) as ReturnType<HttpHandlerFn>;

      return (await firstValueFrom(errorInterceptor(request, next)).catch(
        (thrown) => thrown
      )) as HttpErrorResponse;
    });
  }

  it('passes successful responses through untouched', async () => {
    const response = await TestBed.runInInjectionContext(() => {
      const request = new HttpRequest('GET', '/api/finance/accounts');
      const next: HttpHandlerFn = (req) =>
        of(
          new HttpResponse({ status: 200, url: req.url })
        ) as ReturnType<HttpHandlerFn>;
      return firstValueFrom(errorInterceptor(request, next));
    });

    expect(response).toBeInstanceOf(HttpResponse);
    expect(messageService.addMessage).not.toHaveBeenCalled();
  });

  it('rethrows the original error after reporting it', async () => {
    const error = new HttpErrorResponse({ status: 500 });

    await expect(runWithError(error)).resolves.toBe(error);
    expect(messageService.addMessage).toHaveBeenCalledTimes(1);
  });

  it('surfaces the browser message for a client-side ErrorEvent', async () => {
    const error = new HttpErrorResponse({
      error: new ErrorEvent('network', { message: 'connection reset' }),
      status: 0,
    });

    await runWithError(error);

    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'connection reset',
      type: 'error',
    });
  });

  it.each([
    [
      0,
      undefined,
      'Unable to connect to server. Please check your internet connection.',
      'warning',
    ],
    [400, undefined, 'Invalid request. Please check your input.', 'warning'],
    [
      401,
      undefined,
      'Your session has expired. Please log in again.',
      'warning',
    ],
    [
      403,
      { message: 'ignored' },
      'You do not have permission to perform this action.',
      'error',
    ],
    [404, undefined, 'The requested resource was not found.', 'info'],
    [
      409,
      undefined,
      'A conflict occurred. Please refresh and try again.',
      'warning',
    ],
    [422, undefined, 'Validation error. Please check your input.', 'warning'],
    [
      429,
      undefined,
      'Too many requests. Please wait a moment before trying again.',
      'warning',
    ],
    [
      500,
      undefined,
      'Server error. Our team has been notified. Please try again later.',
      'error',
    ],
    [
      502,
      undefined,
      'Service temporarily unavailable. Please try again later.',
      'warning',
    ],
    [
      503,
      undefined,
      'Service temporarily unavailable. Please try again later.',
      'warning',
    ],
    [
      504,
      undefined,
      'Service temporarily unavailable. Please try again later.',
      'warning',
    ],
    [418, undefined, 'Error: 418', 'error'],
  ])(
    'maps status %i to its default message',
    async (status, body, content, type) => {
      await runWithError(new HttpErrorResponse({ status, error: body }));

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content,
        type,
      });
    }
  );

  it.each([400, 404, 409, 422, 418])(
    'prefers the server supplied message for status %i',
    async (status) => {
      await runWithError(
        new HttpErrorResponse({
          status,
          error: { message: 'the server said no' },
        })
      );

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'the server said no',
        type: expect.any(String),
      });
    }
  );
});
