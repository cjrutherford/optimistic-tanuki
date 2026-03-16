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
    path: 'city/:slug/classifieds',
    loadComponent: () =>
      import('./pages/classifieds/classifieds.component').then(
        (m) => m.ClassifiedsComponent
      ),
  },
  {
    path: 'city/:slug/classifieds/new',
    loadComponent: () =>
      import('./pages/classifieds/classifieds.component').then(
        (m) => m.ClassifiedsComponent
      ),
    canActivate: [MemberGuard],
    data: { openForm: true },
  },
  {
    path: 'city/:slug/classifieds/:id',
    loadComponent: () =>
      import('./pages/classified-detail/classified-detail.component').then(
        (m) => m.ClassifiedDetailComponent
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
    path: 'c/:slug/classifieds/new',
    loadComponent: () =>
      import('./pages/classifieds/classifieds.component').then(
        (m) => m.ClassifiedsComponent
      ),
    canActivate: [MemberGuard],
    data: { openForm: true },
  },
  {
    path: 'c/:slug/classifieds/:id',
    loadComponent: () =>
      import('./pages/classified-detail/classified-detail.component').then(
        (m) => m.ClassifiedDetailComponent
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
    path: 'seller-dashboard',
    loadComponent: () =>
      import('./pages/seller-dashboard/seller-dashboard.component').then(
        (m) => m.SellerDashboardComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./pages/messages/messages.component').then(
        (m) => m.MessagesComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'messages/new',
    loadComponent: () =>
      import('./pages/new-message/new-message.component').then(
        (m) => m.NewMessageComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
