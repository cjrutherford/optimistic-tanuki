import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'vault-portal-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="portal-container">
      <div class="hero-block">
        <span class="hero-pill">Sovereign Compliance Architecture</span>
        <h1 class="hero-title">Practice Vault</h1>
        <p class="hero-lead">
          Statutory compliance platform for regulated CPA, tax, and civil
          litigation law practices. Eliminates unencrypted email attachments,
          halts escrow wire diversion fraud, and enables confidential
          on-premises AI indexing with zero cloud data leakage.
        </p>

        <div class="hero-actions">
          <a routerLink="/drop" class="btn-primary"> Client document drop </a>
          <a routerLink="/escrow-verify" class="btn-secondary">
            Escrow wire verification
          </a>
          <a routerLink="/admin/compliance" class="btn-outline">
            WISP compliance ledger
          </a>
        </div>
      </div>

      <div class="modules-grid">
        <div class="module-card">
          <div class="module-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2 class="module-title">Tokenized Document Drop</h2>
          <p class="module-desc">
            Direct client drop zone eliminating unencrypted email attachments.
            Uploads stream over TCP to an on-premises ClamAV daemon and are
            sealed into an immutable chained SHA-256 ledger.
          </p>
          <div class="module-mandates">
            <span>FTC 16 CFR Part 314</span>
            <span>IRS Pub 4557</span>
          </div>
          <a routerLink="/drop" class="card-link">Launch document drop →</a>
        </div>

        <div class="module-card">
          <div class="module-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2 class="module-title">Escrow Wire Shield</h2>
          <p class="module-desc">
            Closing protection defense neutralizing business email compromise
            (BEC). Bank routing and account numbers remain AES-256-GCM encrypted
            until unlocked by rolling 6-digit TOTP.
          </p>
          <div class="module-mandates">
            <span>ALTA Pillar 3</span>
            <span>ABA Opinion 483</span>
          </div>
          <a routerLink="/escrow-verify" class="card-link">
            Verify wire instructions →
          </a>
        </div>

        <div class="module-card">
          <div class="module-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h2 class="module-title">Air-gapped AI assistant</h2>
          <p class="module-desc">
            On-premises indexing and parsing of tax schedules (Form 1040,
            Schedule C) and legal transcripts via local Ollama
            (qwen2.5-coder:14b / llama3.2). Zero cloud telemetry.
          </p>
          <div class="module-mandates">
            <span>ABA Opinion 477R</span>
            <span>IRS Pub 4557</span>
          </div>
          <a routerLink="/admin/compliance" class="card-link"
            >Access compliance ledger →</a
          >
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .portal-container {
        max-width: 1200px;
        margin: 50px auto;
        padding: 0 24px;
      }
      .hero-block {
        text-align: center;
        max-width: 820px;
        margin: 0 auto 60px auto;
      }
      .hero-pill {
        display: inline-block;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.35);
        color: #7dd3fc;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 4px 14px;
        border-radius: 9999px;
        margin-bottom: 20px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .hero-title {
        font-size: 3rem;
        font-weight: 800;
        color: #f8fafc;
        margin: 0 0 16px 0;
        letter-spacing: -0.03em;
      }
      .hero-lead {
        font-size: 1.15rem;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 32px 0;
      }
      .hero-actions {
        display: flex;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .btn-primary {
        background: #0284c7;
        color: #ffffff;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        transition: background 0.15s ease;
      }
      .btn-primary:hover {
        background: #0369a1;
      }
      .btn-secondary {
        background: rgba(56, 189, 248, 0.15);
        border: 1px solid rgba(56, 189, 248, 0.3);
        color: #e0f2fe;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        transition: all 0.15s ease;
      }
      .btn-secondary:hover {
        background: rgba(56, 189, 248, 0.25);
      }
      .btn-outline {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #cbd5e1;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.95rem;
      }
      .btn-outline:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .modules-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }
      @media (max-width: 900px) {
        .modules-grid {
          grid-template-columns: 1fr;
        }
      }
      .module-card {
        background: #0b1120;
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 12px;
        padding: 32px 24px;
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease;
      }
      .module-card:hover {
        border-color: #38bdf8;
        transform: translateY(-2px);
      }
      .module-icon {
        background: rgba(56, 189, 248, 0.1);
        width: 50px;
        height: 50px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }
      .module-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #f8fafc;
        margin: 0 0 12px 0;
      }
      .module-desc {
        font-size: 0.9rem;
        line-height: 1.6;
        color: #94a3b8;
        margin: 0 0 20px 0;
        flex: 1;
      }
      .module-mandates {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .module-mandates span {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #86efac;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .card-link {
        color: #38bdf8;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .card-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class PortalPageComponent {}
