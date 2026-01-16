import { Route } from '@angular/router';
import { LoginComponent } from './components/login.component';
import { RegisterComponent } from './components/register.component';
import { DashboardComponent } from './components/dashboard.component';
import { UsersManagementComponent } from './components/users-management.component';
import { RolesManagementComponent } from './components/roles-management.component';
import { PermissionsManagementComponent } from './components/permissions-management.component';
import { AppScopesManagementComponent } from './components/app-scopes-management.component';
import { ThemeManagementComponent } from './components/theme-management.component';
import { PermissionsInspectorComponent } from './components/permissions-inspector.component';
import { ProductManagementComponent } from './components/product-management.component';
import { OrderManagementComponent } from './components/order-management.component';
import { StoreOverviewComponent } from './components/store-overview.component';
import { AppointmentManagementComponent } from './components/appointment-management.component';
import { AvailabilityManagementComponent } from './components/availability-management.component';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: 'users', component: UsersManagementComponent },
      { path: 'roles', component: RolesManagementComponent },
      { path: 'permissions', component: PermissionsManagementComponent },
      {
        path: 'permissions-inspector',
        component: PermissionsInspectorComponent,
      },
      { path: 'app-scopes', component: AppScopesManagementComponent },
      { path: 'theme', component: ThemeManagementComponent },
      { path: 'store/overview', component: StoreOverviewComponent },
      { path: 'store/products', component: ProductManagementComponent },
      { path: 'store/orders', component: OrderManagementComponent },
      { path: 'store/appointments', component: AppointmentManagementComponent },
      { path: 'store/availability', component: AvailabilityManagementComponent },
      { path: '', redirectTo: 'users', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
];
