import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'vault-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="vault-nav-header">
      <div class="nav-container">
        <a routerLink="/" class="nav-brand" aria-label="Practice Vault home">
          <div class="brand-shield-icon" aria-hidden="true">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div class="brand-text-block">
            <span class="brand-title">Practice Vault</span>
            <span class="brand-sub">Escrow Wire Shield</span>
          </div>
        </a>

        <nav class="nav-links" aria-label="Primary">
          <a
            routerLink="/drop"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="nav-link"
          >
            Client document drop
          </a>
          <a
            routerLink="/escrow-verify"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="nav-link"
          >
            Escrow wire verification
          </a>
          <a
            routerLink="/admin/compliance"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="nav-link"
          >
            WISP compliance ledger
          </a>
        </nav>

        <div class="compliance-badge" aria-label="Applicable standards">
          <span class="statutory-pill">FTC 16 CFR Part 314</span>
          <span class="statutory-pill">IRS Pub 4557</span>
          <span class="statutory-pill">ALTA Pillar 3</span>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .vault-nav-header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .nav-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }
      .brand-shield-icon {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
        display: flex;
        color: var(--accent);
      }
      .brand-text-block {
        display: flex;
        flex-direction: column;
      }
      .brand-title {
        color: var(--foreground);
        font-weight: 700;
        font-size: 1.15rem;
        letter-spacing: -0.01em;
      }
      .brand-sub {
        color: var(--accent);
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .nav-links {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .nav-link {
        color: var(--foreground-muted);
        text-decoration: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        transition: color 0.15s ease, background 0.15s ease;
      }
      .nav-link:hover {
        color: var(--foreground);
        background: color-mix(in srgb, var(--foreground) 5%, transparent);
      }
      .nav-link.active {
        color: var(--accent);
        background: color-mix(in srgb, var(--accent) 12%, transparent);
      }
      .compliance-badge {
        display: flex;
        gap: 6px;
      }
      .statutory-pill {
        background: var(--trust-badge-bg);
        border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
        color: var(--trust-badge-color);
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }
      @media (max-width: 800px) {
        .compliance-badge {
          display: none;
        }
      }
    `,
  ],
})
export class HeaderComponent {
  @Input() firmName = 'Practice Vault';
}
