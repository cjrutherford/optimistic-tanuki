import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'communities',
    loadComponent: () =>
      import('./pages/communities/communities.component').then(
        (m) => m.CommunitiesComponent
      ),
  },
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('./pages/community/community.component').then(
        (m) => m.CommunityComponent
      ),
  },
  {
    path: 'c/:slug/classifieds',
    loadComponent: () =>
      import('./pages/classifieds/classifieds.component').then(
        (m) => m.ClassifiedsComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./pages/account/account.component').then(
        (m) => m.AccountComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
