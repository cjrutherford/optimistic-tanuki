import {
  ApplicationConfig,
  provideZoneChangeDetection,
  Injectable,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
  HttpRequest,
  HttpHandler,
  HttpInterceptor,
} from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

@Injectable()
class AppScopeInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    // Determine app scope based on API route to align with
    // permissions configuration (social endpoints use the
    // "social" app scope, blogging uses "blogging", etc.).
    let appScope = 'christopherrutherford-net';
    const url = req.url || '';

    if (url.includes('/api/social')) {
      appScope = 'social';
    } else if (url.includes('/api/blog')) {
      appScope = 'blogging';
    } else if (url.includes('/api/project')) {
      appScope = 'project-planning';
    } else if (url.includes('/api/forum')) {
      appScope = 'forum';
    }

    const cloned = req.clone({
      setHeaders: { 'X-ot-appscope': appScope },
    });
    return next.handle(cloned);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AppScopeInterceptor,
      multi: true,
    },
  ],
};
