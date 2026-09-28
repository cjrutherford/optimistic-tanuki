import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'nexus-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="nexus-nav-header">
      <div class="nav-container">
        <a routerLink="/" class="nav-brand" aria-label="Project Nexus home">
          <div class="brand-beam-icon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 20h20" />
              <path d="M4 20V9l8-5 8 5v11" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </div>
          <div class="brand-text-block">
            <span class="brand-title">Project Nexus</span>
            <span class="brand-sub">Commercial construction operations</span>
          </div>
        </a>

        <nav class="nav-links" aria-label="Primary">
          <a
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
            class="nav-link"
          >
            Projects
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: [
    `
      .nexus-nav-header {
        background: var(--surface);
        border-bottom: 2px solid var(--primary);
      }
      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 32px;
        flex-wrap: wrap;
      }
      .nav-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--foreground);
      }
      .brand-beam-icon {
        color: var(--accent);
        display: flex;
      }
      .brand-title {
        display: block;
        font-weight: 800;
        font-size: 1.05rem;
      }
      .brand-sub {
        display: block;
        font-size: 0.72rem;
        color: var(--foreground-muted);
      }
      .nav-links {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .nav-link {
        color: var(--foreground-secondary);
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.9rem;
      }
      .nav-link:hover {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .nav-link.active {
        color: var(--accent);
        background: color-mix(in srgb, var(--accent) 15%, transparent);
      }
    `,
  ],
})
export class HeaderComponent {}
