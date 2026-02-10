import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './http.interceptor';
import { API_BASE_URL } from './types';
import {
  ProfileEditorComponent,
  BannerComponent,
  ProfilePhotoComponent,
} from '@optimistic-tanuki/profile-ui';
import { ModalComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  ImageUploadComponent,
} from '@optimistic-tanuki/form-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([AuthInterceptor])),
    {
      provide: API_BASE_URL,
      useValue: '/api',
    },
  ],
};
