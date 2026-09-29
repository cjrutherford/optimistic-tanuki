import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PersonalitySceneComponent } from '@optimistic-tanuki/motion-ui';
import { BugReportUiComponent } from '@optimistic-tanuki/bug-report-ui';

@Component({
  imports: [RouterModule, PersonalitySceneComponent, BugReportUiComponent],
  selector: 'app-root',
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>

    @if (isBrowser) {
    <div class="motion-background" aria-hidden="true">
      <otui-personality-scene
        height="100vh"
        fallbackScene="signal-mesh"
        [density]="5"
        [speed]="0.4"
        [intensity]="0.5"
      ></otui-personality-scene>
    </div>
    }

    <main id="main-content" class="app-content">
      <router-outlet></router-outlet>
    </main>
    <lib-bug-report-ui />
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly platformId = inject(PLATFORM_ID);

  protected title = 'owner-console';

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
