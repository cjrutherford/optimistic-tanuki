import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';

/**
 * Root AppComponent now delegates configuration loading to AppResolverComponent
 * This simplifies the architecture and enables multi-tenant support via routing
 */
@Component({
  imports: [CommonModule, RouterModule, HaiAboutTagComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected title = 'configurable-client';
  protected readonly haiAboutConfig = {
    appId: 'configurable-client',
    appName: 'Configurable Client',
    appTagline: 'Multi-tenant configurable HAI application shells.',
    appDescription:
      'Configurable Client is the HAI app shell for tenant-driven and dynamically composed application experiences.',
    appUrl: '/configurable-client',
  };
}
