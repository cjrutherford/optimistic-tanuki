import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DEFAULT_TRAINER_SITE_CONFIG,
  TrainerApiService,
  TrainerSiteConfig,
  SiteConfigResponse,
} from '@optimistic-tanuki/trainer-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-site-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  template: `
    <div class="editor-shell">
      <div class="page-header">
        <h1>Site Content Editor</h1>
        <p>Edit your public landing-page copy. Changes take effect after saving.</p>
      </div>

      @if (loading()) {
        <p class="status-msg">Loading current site content…</p>
      } @else {

        <!-- Brand section -->
        <otui-card class="section-card">
          <h2 class="section-title">Brand &amp; Identity</h2>
          <div class="field-grid">
            <label>
              Business Name
              <input [(ngModel)]="draft().brand.businessName" />
            </label>
            <label>
              Monogram (2 letters)
              <input [(ngModel)]="draft().brand.monogram" maxlength="3" />
            </label>
            <label>
              Trainer Name
              <input [(ngModel)]="draft().brand.trainerName" />
            </label>
            <label class="full">
              Tagline
              <input [(ngModel)]="draft().brand.tagline" />
            </label>
            <label class="full">
              Short Intro
              <input [(ngModel)]="draft().brand.intro" />
            </label>
            <label class="full">
              Full Bio
              <textarea rows="4" [(ngModel)]="draft().brand.longBio"></textarea>
            </label>
          </div>
        </otui-card>

        <!-- Contact section -->
        <otui-card class="section-card">
          <h2 class="section-title">Contact Details</h2>
          <div class="field-grid">
            <label>
              Email
              <input type="email" [(ngModel)]="draft().contact.email" />
            </label>
            <label>
              Phone
              <input type="tel" [(ngModel)]="draft().contact.phone" />
            </label>
            <label class="full">
              Location / Notes
              <input [(ngModel)]="draft().contact.location" />
            </label>
            <label>
              Consultation CTA Label
              <input [(ngModel)]="draft().contact.consultationLabel" />
            </label>
          </div>
        </otui-card>

        <!-- Client Portal copy section -->
        <otui-card class="section-card">
          <h2 class="section-title">Client Portal Copy</h2>
          <div class="field-grid">
            <label class="full">
              Headline
              <input [(ngModel)]="draft().clientPortal.headline" />
            </label>
            <label class="full">
              Description
              <textarea rows="3" [(ngModel)]="draft().clientPortal.description"></textarea>
            </label>
          </div>
        </otui-card>

        <!-- Testimonials section -->
        <otui-card class="section-card">
          <h2 class="section-title">Testimonials</h2>
          @for (t of draft().testimonials; track $index) {
            <div class="testimonial-entry">
              <label>
                Quote
                <textarea rows="2" [(ngModel)]="t.quote"></textarea>
              </label>
              <label>
                Client Name
                <input [(ngModel)]="t.clientName" />
              </label>
              <label>
                Client Detail
                <input [(ngModel)]="t.clientDetail" />
              </label>
            </div>
          }
        </otui-card>

        <!-- Actions -->
        @if (successMsg()) {
          <p class="status-msg success">{{ successMsg() }}</p>
        }
        @if (errorMsg()) {
          <p class="status-msg error">{{ errorMsg() }}</p>
        }

        <div class="actions">
          <button class="otui-btn primary" [disabled]="saving()" (click)="save()">
            @if (saving()) { Saving… } @else { Save Changes }
          </button>
          <button class="otui-btn ghost" (click)="reset()">Reset to Defaults</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .editor-shell {
        display: grid;
        gap: 1.5rem;
      }

      .page-header h1 {
        margin: 0 0 0.4rem;
        font-family: 'Instrument Serif', serif;
        font-weight: 400;
        font-size: 2rem;
      }

      .page-header p {
        margin: 0;
        color: var(--muted, #6b7280);
      }

      .section-card {
        display: grid;
        gap: 1.2rem;
      }

      .section-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground, #0f172a);
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
      }

      .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .field-grid label.full {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--foreground, #0f172a);
      }

      input,
      textarea {
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-border-radius, 0.5rem);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        font-size: 0.9rem;
        font-family: inherit;
        resize: vertical;
        transition: border-color 160ms ease;
      }

      input:focus,
      textarea:focus {
        outline: none;
        border-color: var(--primary, #1f7a63);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #1f7a63) 14%, transparent);
      }

      .testimonial-entry {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.8rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
      }

      .testimonial-entry label:first-child {
        grid-column: 1 / -1;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
      }

      .otui-btn {
        padding: 0.7rem 1.5rem;
        border-radius: var(--personality-button-radius, 999px);
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        font-family: inherit;
        transition: background 160ms ease;
      }

      .otui-btn.primary {
        background: var(--primary, #1f7a63);
        color: white;
        border: none;
      }

      .otui-btn.primary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary, #1f7a63) 88%, black);
      }

      .otui-btn.ghost {
        background: transparent;
        border: 1px solid var(--border, #e2e8f0);
        color: var(--foreground, #0f172a);
      }

      .otui-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .status-msg {
        font-size: 0.88rem;
        padding: 0.6rem 1rem;
        border-radius: 0.4rem;
        margin: 0;
      }

      .status-msg.success {
        color: #166534;
        background: #dcfce7;
      }

      .status-msg.error {
        color: #991b1b;
        background: #fee2e2;
      }

      @media (max-width: 640px) {
        .field-grid {
          grid-template-columns: 1fr;
        }

        .testimonial-entry {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TrainerSiteEditorPageComponent {
  private readonly api = inject(TrainerApiService);

  loading = signal(true);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  private configId: string | null = null;
  draft = signal<TrainerSiteConfig>(
    JSON.parse(JSON.stringify(DEFAULT_TRAINER_SITE_CONFIG))
  );

  constructor() {
    this.api.getSiteConfig().subscribe({
      next: (res: SiteConfigResponse) => {
        this.loading.set(false);
        this.configId = res.configId ?? null;
        this.draft.set({
          ...DEFAULT_TRAINER_SITE_CONFIG,
          ...(res.config ?? {}),
        });
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    this.api
      .updateSiteConfig(this.configId, this.draft())
      .subscribe({
        next: (saved: any) => {
          this.saving.set(false);
          if (saved?.id && this.configId === null) {
            this.configId = saved.id;
          }
          this.successMsg.set('Site content saved successfully.');
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(
            err?.error?.message || err?.message || 'Save failed. Please try again.'
          );
        },
      });
  }

  reset(): void {
    this.draft.set(JSON.parse(JSON.stringify(DEFAULT_TRAINER_SITE_CONFIG)));
    this.successMsg.set('');
    this.errorMsg.set('');
  }
}
