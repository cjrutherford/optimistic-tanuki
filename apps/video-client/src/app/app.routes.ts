import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { WatchComponent } from './pages/watch/watch.component';
import { ChannelComponent } from './pages/channel/channel.component';

export const appRoutes: Route[] = [
  { path: '', component: HomeComponent },
  { path: 'watch/:id', component: WatchComponent },
  { path: 'channel/:id', component: ChannelComponent },
  { path: '**', redirectTo: '' },
];
