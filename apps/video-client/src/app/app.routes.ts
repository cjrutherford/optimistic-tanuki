import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { WatchComponent } from './pages/watch/watch.component';
import { ChannelComponent } from './pages/channel/channel.component';
import { LocalBrowseComponent } from './pages/local-browse/local-browse.component';
import { UploadComponent } from './pages/upload/upload.component';
import { LoginComponent } from './components/login.component';
import { RegisterComponent } from './components/register.component';
import {
  emailAuthRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';
import { ProfileSettingsComponent } from './components/profile-settings.component';
import { ViewHistoryComponent } from './components/view-history.component';
import { MyChannelComponent } from './components/my-channel.component';
import { LivePlaybackComponent } from './pages/live-playback/live-playback.component';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  ...emailAuthRoutes('authToken'),
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'oauth/callback', component: OAuthCallbackComponent },
  { path: 'watch/:id', component: WatchComponent },
  { path: 'watch/live/:slugOrId', component: LivePlaybackComponent },
  { path: 'browse/local', component: LocalBrowseComponent },
  { path: 'c/:slugOrId', component: ChannelComponent },
  { path: 'channel/:slugOrId', component: ChannelComponent },
  { path: 'upload', component: UploadComponent, canActivate: [authGuard] },
  {
    path: 'profile',
    component: ProfileSettingsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'history',
    component: ViewHistoryComponent,
    canActivate: [authGuard],
  },
  {
    path: 'my-channel',
    component: MyChannelComponent,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
