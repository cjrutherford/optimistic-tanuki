import { Route } from '@angular/router';
import { PortalPageComponent } from './components/portal/portal-page.component';
import { DropPageComponent } from './components/drop/drop-page.component';
import { EscrowVerifyPageComponent } from './components/escrow-verify/escrow-verify-page.component';
import { CompliancePageComponent } from './components/compliance/compliance-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: PortalPageComponent,
  },
  {
    path: 'drop',
    component: DropPageComponent,
  },
  {
    path: 'drop/:token',
    component: DropPageComponent,
  },
  {
    path: 'escrow-verify',
    component: EscrowVerifyPageComponent,
  },
  {
    path: 'escrow-verify/:token',
    component: EscrowVerifyPageComponent,
  },
  {
    path: 'admin/compliance',
    component: CompliancePageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
