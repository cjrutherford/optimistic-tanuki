import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '', 
        loadComponent: () => import('./components/main-page/main-page.component').then(m => m.MainPageComponent)
    },
    {
        path: 'login',
        loadComponent: () => import('./components/login-page/login-page.component').then(m => m.LoginPageComponent)
    },
    {
        path: 'blog',
        loadComponent: () => import('./components/blog-page/blog-page.component').then(m => m.BlogPageComponent)
    },
    {
        path: 'blog/:id',
        loadComponent: () => import('./components/blog-page/blog-page.component').then(m => m.BlogPageComponent),
        data: { id: null},
    }
];
