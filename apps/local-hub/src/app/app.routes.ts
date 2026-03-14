import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { MemberGuard } from './guards/member.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'cities',
    loadComponent: () =>
      import('./pages/cities/cities.component').then((m) => m.CitiesComponent),
  },
  {
    path: 'city/:slug',
    loadComponent: () =>
      import('./pages/city/city.component').then((m) => m.CityComponent),
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
    path: 'c/:slug/classifieds/new',
    loadComponent: () =>
      import('./pages/classifieds/classifieds.component').then(
        (m) => m.ClassifiedsComponent
      ),
    canActivate: [MemberGuard],
    data: { openForm: true },
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
