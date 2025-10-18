import { Route } from '@angular/router';
import { AuthenticationGuard } from './authentication.guard';
import { ProfileGuard } from './profile.guard';

export const appRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./pages/projects/projects.component').then(m => m.ProjectsComponent),
        title: 'Projects',
        canActivate: [AuthenticationGuard, ProfileGuard],
    },
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Profile',
        canActivate: [AuthenticationGuard],
    },
    {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Settings',
        canActivate: [AuthenticationGuard],
    },
    {
        path: 'login',
        loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
        title: 'Login',
    },
    {
        path: 'register',
        loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
        title: 'Register',
    },
    {
        path: '**',
        redirectTo: ''
    }
];
