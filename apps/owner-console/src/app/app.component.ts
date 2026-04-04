import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SignalMeshComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  imports: [RouterModule, SignalMeshComponent],
  selector: 'app-root',
  template: `
    @if (isBrowser) {
    <div class="motion-background" aria-hidden="true">
      <otui-signal-mesh
        [reducedMotion]="reducedMotion"
        height="100vh"
        [density]="5"
        [speed]="0.4"
        [intensity]="0.5"
      ></otui-signal-mesh>
    </div>
    }

    <div class="app-content">
      <router-outlet></router-outlet>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly platformId = inject(PLATFORM_ID);

  protected title = 'owner-console';

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get reducedMotion(): boolean {
    if (!this.isBrowser) {
      return true;
    }

    if (typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
