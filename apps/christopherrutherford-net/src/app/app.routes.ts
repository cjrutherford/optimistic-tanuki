import { Route } from '@angular/router';

export const appRoutes: Route[] = [{
    path: '**',
    loadComponent: () => import('../landing/landing.component').then(m => m.LandingComponent)
}];
