import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  HttpRequest,
  HttpHandler,
} from '@angular/common/http';
import {} from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: class {
        intercept(req: HttpRequest<unknown>, next: HttpHandler) {
          const cloned = req.clone({
            setHeaders: { 'X-ot-appscope': 'digital-homestead' },
          });
          return next.handle(cloned);
        }
      },
      multi: true,
    },
  ],
};
