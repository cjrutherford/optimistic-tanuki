import { Route } from '@angular/router';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { CartComponent } from './pages/cart/cart.component';
import { DonationsComponent } from './pages/donations/donations.component';
import { BookingsComponent } from './pages/bookings/bookings.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/catalog', pathMatch: 'full' },
  { path: 'catalog', component: CatalogComponent },
  { path: 'cart', component: CartComponent },
  { path: 'donations', component: DonationsComponent },
  { path: 'bookings', component: BookingsComponent },
];
