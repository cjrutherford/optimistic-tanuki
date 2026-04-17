import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';
      let errorType: 'error' | 'warning' | 'info' = 'error';

      if (error.error instanceof ErrorEvent) {
        errorMessage = error.error.message;
      } else {
        switch (error.status) {
          case 0:
            errorMessage =
              'Unable to connect to server. Please check your internet connection.';
            errorType = 'warning';
            break;
          case 400:
            errorMessage =
              error.error?.message ||
              'Invalid request. Please check your input.';
            errorType = 'warning';
            break;
          case 401:
            errorMessage = 'Your session has expired. Please log in again.';
            errorType = 'warning';
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage =
              error.error?.message || 'The requested resource was not found.';
            errorType = 'info';
            break;
          case 409:
            errorMessage =
              error.error?.message ||
              'A conflict occurred. Please refresh and try again.';
            errorType = 'warning';
            break;
          case 422:
            errorMessage =
              error.error?.message ||
              'Validation error. Please check your input.';
            errorType = 'warning';
            break;
          case 429:
            errorMessage =
              'Too many requests. Please wait a moment before trying again.';
            errorType = 'warning';
            break;
          case 500:
            errorMessage =
              'Server error. Our team has been notified. Please try again later.';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage =
              'Service temporarily unavailable. Please try again later.';
            errorType = 'warning';
            break;
          default:
            errorMessage = error.error?.message || `Error: ${error.status}`;
        }
      }

      messageService.addMessage({
        content: errorMessage,
        type: errorType,
      });

      return throwError(() => error);
    })
  );
};
