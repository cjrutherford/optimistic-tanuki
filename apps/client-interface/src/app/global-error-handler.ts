import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private messageService = inject(MessageService);

  handleError(error: Error) {
    console.error('Global error:', error);

    if (
      error.message?.includes('ExpressionChangedAfterItHasBeenCheckedError')
    ) {
      if (typeof ngDevMode === 'undefined' || !ngDevMode) {
        this.showError('An error occurred. Please refresh the page.');
      }
      return;
    }

    this.showError('An unexpected error occurred. Please try again.');
  }

  private showError(message: string) {
    this.messageService.addMessage({
      content: message,
      type: 'error',
    });
  }
}
