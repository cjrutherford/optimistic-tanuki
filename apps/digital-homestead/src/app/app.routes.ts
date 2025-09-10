import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '', 
        loadComponent: () => import('./components/main-page/main-page.component').then(m => m.MainPageComponent)
    },{
        path: 'blog',
        loadComponent: () => import('./components/blog-page/blog-page.component').then(m => m.BlogPageComponent)
    }
];
