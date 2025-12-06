import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'app-theme-management',
  standalone: true,
  imports: [CommonModule, ThemeDesignerComponent],
  template: `
    <div class="theme-management-container">
      <div class="header">
        <h1>Theme Management</h1>
        <p class="subtitle">
          Customize the theme for christopherrutherford-net. These settings
          will be applied globally across the site.
        </p>
        <div class="info-box">
          <strong>Note:</strong> This is a proof of concept for centralized
          theme management. In a production environment, these settings would
          be persisted to a backend service and applied to the target
          application.
        </div>
      </div>

      <div class="theme-designer-wrapper">
        <lib-theme-designer></lib-theme-designer>
      </div>
    </div>
  `,
  styles: [
    `
      .theme-management-container {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        margin-bottom: 2rem;

        h1 {
          font-size: 2rem;
          color: var(--foreground, #212121);
          margin-bottom: 0.5rem;
        }

        .subtitle {
          font-size: 1.1rem;
          color: var(--foreground-secondary, #666);
          margin-bottom: 1rem;
        }

        .info-box {
          padding: 1rem;
          background: var(--accent-shade-lighten-95, #e3f2fd);
          border-left: 4px solid var(--accent, #3f51b5);
          border-radius: 4px;
          color: var(--foreground, #212121);
          font-size: 0.95rem;

          strong {
            color: var(--accent, #3f51b5);
          }
        }
      }

      .theme-designer-wrapper {
        background: var(--background, #ffffff);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    `,
  ],
})
export class ThemeManagementComponent {}
