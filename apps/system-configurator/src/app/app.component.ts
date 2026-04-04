import {
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { AuthStateService } from './state/auth-state.service';

@Component({
  standalone: true,
  imports: [RouterModule, HaiAboutTagComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly brandName = 'HAI Computer';
  readonly fullBrandName = 'Hopeful Aspirations Integrators Computers';
  readonly haiAboutConfig = {
    appId: 'hai-computer',
    appName: 'HAI Computer',
    appTagline: 'Pre-configured personal cloud and homelab systems.',
    appDescription:
      'HAI Computer is the system planning and purchasing path for personal-cloud, homelab, and private-compute hardware prepared for digital homesteading.',
    appUrl: '/hai-computer',
  };
  readonly authState = inject(AuthStateService);

  readonly isAuthenticated = signal(false);
  readonly actionLabel = computed(() =>
    this.isAuthenticated() ? 'Sign out' : 'Log in'
  );

  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.authState.isAuthenticated$().subscribe((value) => {
      this.isAuthenticated.set(value);
    });

    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setPersonality('control-center');
      this.themeService.setPrimaryColor('#2dd4bf');
    }
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }

  handleAuthAction(): void {
    if (this.isAuthenticated()) {
      this.authState.logout();
      this.router.navigate(['/']);
      return;
    }

    this.router.navigate(['/login']);
  }
}
