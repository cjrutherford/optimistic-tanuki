import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'motion-ui',
    loadComponent: () =>
      import('./pages/motion-ui/motion-ui-page.component').then(
        (m) => m.MotionUiPageComponent
      ),
  },
  {
    path: 'common-ui',
    loadComponent: () =>
      import('./pages/common-ui/common-ui-page.component').then(
        (m) => m.CommonUiPageComponent
      ),
  },
  {
    path: 'form-ui',
    loadComponent: () =>
      import('./pages/form-ui/form-ui-page.component').then(
        (m) => m.FormUiPageComponent
      ),
  },
  {
    path: 'theme-ui',
    loadComponent: () =>
      import('./pages/theme-ui/theme-ui-page.component').then(
        (m) => m.ThemeUiPageComponent
      ),
  },
  {
    path: 'navigation-ui',
    loadComponent: () =>
      import('./pages/navigation-ui/navigation-ui-page.component').then(
        (m) => m.NavigationUiPageComponent
      ),
  },
  {
    path: 'social-ui',
    loadComponent: () =>
      import('./pages/social-ui/social-ui-page.component').then(
        (m) => m.SocialUiPageComponent
      ),
  },
  {
    path: 'notification-ui',
    loadComponent: () =>
      import('./pages/notification-ui/notification-ui-page.component').then(
        (m) => m.NotificationUiPageComponent
      ),
  },
  {
    path: 'store-ui',
    loadComponent: () =>
      import('./pages/store-ui/store-ui-page.component').then(
        (m) => m.StoreUiPageComponent
      ),
  },
  {
    path: 'auth-ui',
    loadComponent: () =>
      import('./pages/auth-ui/auth-ui-page.component').then(
        (m) => m.AuthUiPageComponent
      ),
  },
  {
    path: 'profile-ui',
    loadComponent: () =>
      import('./pages/profile-ui/profile-ui-page.component').then(
        (m) => m.ProfileUiPageComponent
      ),
  },
  {
    path: 'chat-ui',
    loadComponent: () =>
      import('./pages/chat-ui/chat-ui-page.component').then(
        (m) => m.ChatUiPageComponent
      ),
  },
  {
    path: 'message-ui',
    loadComponent: () =>
      import('./pages/message-ui/message-ui-page.component').then(
        (m) => m.MessageUiPageComponent
      ),
  },
  {
    path: 'search-ui',
    loadComponent: () =>
      import('./pages/search-ui/search-ui-page.component').then(
        (m) => m.SearchUiPageComponent
      ),
  },
  {
    path: 'persona-ui',
    loadComponent: () =>
      import('./pages/persona-ui/persona-ui-page.component').then(
        (m) => m.PersonaUiPageComponent
      ),
  },
  {
    path: 'ag-grid-ui',
    loadComponent: () =>
      import('./pages/ag-grid-ui/ag-grid-ui-page.component').then(
        (m) => m.AgGridUiPageComponent
      ),
  },
  {
    path: 'validation',
    loadComponent: () =>
      import('./pages/validation/validation-page.component').then(
        (m) => m.ValidationPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
