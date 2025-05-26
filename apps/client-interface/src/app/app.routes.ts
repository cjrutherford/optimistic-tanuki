import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard'; // Import the AuthGuard

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./components/landing.component').then(m => m.LandingComponent),
    },{
        path: 'register',
        loadComponent: () => import('./components/register.component').then(m => m.RegisterComponent),
    },{
        path: 'login',
        loadComponent: () => import('./components/login.component').then(m => m.LoginComponent),
    },{
        path: 'feed',
        loadComponent: () => import('./components/social/feed.component').then(m => m.FeedComponent),
        canActivate: [AuthGuard] // Protect the feed route
    },{
        path: 'profile',
        loadComponent: () => import('./components/profile.component').then(m => m.ProfileComponent),
        canActivate: [AuthGuard] // Protect the profile route
    },{
        path: 'tasks',
        loadComponent: () => import('./components/tasks/tasks.component').then(m => m.TasksComponent),
        canActivate: [AuthGuard] // Protect the tasks route
    },{
        path: '**',
        redirectTo: 'feed'
    }
];
