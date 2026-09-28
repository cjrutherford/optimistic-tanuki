import { Route } from '@angular/router';
import { PortalPageComponent } from './components/portal/portal-page.component';
import { MilestonesPageComponent } from './components/milestones/milestones-page.component';
import { DrawingsPageComponent } from './components/drawings/drawings-page.component';
import { PhotosPageComponent } from './components/photos/photos-page.component';
import { ChangeOrdersPageComponent } from './components/change-orders/change-orders-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: PortalPageComponent,
  },
  {
    path: 'projects/:id/milestones',
    component: MilestonesPageComponent,
  },
  {
    path: 'projects/:id/drawings',
    component: DrawingsPageComponent,
  },
  {
    path: 'projects/:id/photos',
    component: PhotosPageComponent,
  },
  {
    path: 'projects/:id/change-orders',
    component: ChangeOrdersPageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
