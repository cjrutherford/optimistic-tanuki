import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'civic-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="civic-nav-header">
      <div class="nav-container">
        <a routerLink="/" class="nav-brand" aria-label="Civic Core home">
          <div class="brand-mark" aria-hidden="true">
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
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-4h6v4" />
            </svg>
          </div>
          <div class="brand-text-block">
            <span class="brand-title">Civic Core</span>
            <span class="brand-sub">Municipal transparency portal</span>
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
            Meetings
          </a>
          <a
            routerLink="/projects"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="nav-link"
          >
            Infrastructure projects
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: [
    `
      .civic-nav-header {
        background: var(--surface);
        border-bottom: 3px solid var(--primary);
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
      .brand-mark {
        color: var(--primary);
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
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .nav-link:hover {
        text-decoration: underline;
      }
      .nav-link.active {
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 10%, transparent);
      }
    `,
  ],
})
export class HeaderComponent {}
