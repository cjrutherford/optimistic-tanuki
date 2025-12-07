import {
  ApplicationConfig,
  inject,
  provideZoneChangeDetection,
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
import { Injectable } from '@angular/core';
import { AuthStateService } from './auth-state.service';

@Injectable()
class AppScopeInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const cloned = req.clone({
      setHeaders: { 'X-ot-appscope': 'digital-homestead' },
    });
    return next.handle(cloned);
  }
}

@Injectable()
class HttpBearerAuthInterceptor implements HttpInterceptor {
  private readonly authStateService = inject(AuthStateService);
  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const token = this.authStateService.getToken();
    if (token) {
      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next.handle(cloned);
    }
    return next.handle(req);
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
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpBearerAuthInterceptor,
      multi: true,
    },
  ],
};
