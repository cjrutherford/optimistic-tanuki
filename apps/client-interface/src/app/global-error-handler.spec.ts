import { TestBed } from '@angular/core/testing';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { GlobalErrorHandler } from './global-error-handler';

declare const globalThis: Record<string, unknown>;

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let addMessage: jest.Mock;
  let consoleError: jest.SpyInstance;
  const originalNgDevMode = globalThis['ngDevMode'];

  beforeEach(() => {
    addMessage = jest.fn();
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: MessageService, useValue: { addMessage } },
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  afterEach(() => {
    consoleError.mockRestore();
    globalThis['ngDevMode'] = originalNgDevMode;
  });

  it('logs the error and surfaces a generic message', () => {
    const error = new Error('boom');

    handler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith('Global error:', error);
    expect(addMessage).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again.',
      type: 'error',
    });
  });

  it('stays silent for ExpressionChangedAfterItHasBeenChecked in dev mode', () => {
    globalThis['ngDevMode'] = true;

    handler.handleError(
      new Error('NG0100: ExpressionChangedAfterItHasBeenCheckedError')
    );

    expect(addMessage).not.toHaveBeenCalled();
  });

  it('asks the user to refresh for ExpressionChangedAfterItHasBeenChecked outside dev mode', () => {
    globalThis['ngDevMode'] = false;

    handler.handleError(
      new Error('NG0100: ExpressionChangedAfterItHasBeenCheckedError')
    );

    expect(addMessage).toHaveBeenCalledWith({
      content: 'An error occurred. Please refresh the page.',
      type: 'error',
    });
  });

  it('tolerates errors without a message', () => {
    handler.handleError({} as Error);

    expect(addMessage).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again.',
      type: 'error',
    });
  });
});
