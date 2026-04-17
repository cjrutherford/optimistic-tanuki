import { inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';

export function createErrorHandler() {
  const messageService = inject(MessageService);

  return {
    handleError(error: any, customMessage?: string) {
      const message = customMessage || 'An error occurred';
      console.error(message, error);

      messageService.addMessage({
        content: message,
        type: 'error',
      });

      throw error;
    },

    handleWarning(message: string) {
      messageService.addMessage({
        content: message,
        type: 'warning',
      });
    },

    handleSuccess(message: string) {
      messageService.addMessage({
        content: message,
        type: 'success',
      });
    },

    handleInfo(message: string) {
      messageService.addMessage({
        content: message,
        type: 'info',
      });
    },
  };
}
