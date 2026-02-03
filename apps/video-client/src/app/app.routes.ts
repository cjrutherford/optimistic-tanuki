import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { WatchComponent } from './pages/watch/watch.component';
import { ChannelComponent } from './pages/channel/channel.component';
import { UploadComponent } from './pages/upload/upload.component';
import { LoginComponent } from './components/login.component';
import { RegisterComponent } from './components/register.component';
import { ProfileSettingsComponent } from './components/profile-settings.component';
import { ViewHistoryComponent } from './components/view-history.component';
import { MyChannelComponent } from './components/my-channel.component';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'watch/:id', component: WatchComponent },
  { path: 'channel/:id', component: ChannelComponent },
  { path: 'upload', component: UploadComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileSettingsComponent, canActivate: [authGuard] },
  { path: 'history', component: ViewHistoryComponent, canActivate: [authGuard] },
  { path: 'my-channel', component: MyChannelComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
