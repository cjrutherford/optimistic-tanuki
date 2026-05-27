import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CampaignAsset, MaterialSurface } from '../types';

@Component({
  selector: 'app-material-template-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="template-preview" [ngClass]="previewClasses()">
      <div class="template-rail">
        <span class="template-chip">{{
          asset().templateName || asset().layoutVariant
        }}</span>
        <span class="template-label"
          >{{ asset().label }} · {{ surface().label }}</span
        >
      </div>

      <div class="template-body">
        <section
          *ngFor="let block of surface().textBlocks"
          class="template-block"
          [ngClass]="block.role"
        >
          <span class="block-label">{{ block.label }}</span>
          <div
            class="block-html"
            [innerHTML]="normalizeBlockValue(block.value)"
          ></div>
        </section>
      </div>
    </article>
  `,
  styles: [
    `
      .template-preview {
        display: grid;
        min-height: 18rem;
        padding: 1.1rem;
        border-radius: calc(var(--border-radius-lg, 20px) - 4px);
        overflow: hidden;
        border: 1px solid
          color-mix(in srgb, var(--asset-accent, #34d399) 35%, transparent);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--asset-accent, #34d399) 24%, transparent),
            transparent 28%
          ),
          linear-gradient(
            155deg,
            color-mix(in srgb, var(--asset-primary, #d97706) 18%, #120f11),
            #171320 58%,
            #0f1720
          );
      }

      .template-rail {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 1rem;
        font-size: 0.78rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .template-chip,
      .template-label {
        display: inline-flex;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, white 10%, transparent);
        color: color-mix(in srgb, white 84%, transparent);
      }

      .template-body {
        display: grid;
        gap: 0.9rem;
        align-content: start;
      }

      .template-block {
        display: grid;
        gap: 0.35rem;
      }

      .block-label {
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: color-mix(in srgb, white 60%, transparent);
      }

      .block-html {
        color: color-mix(in srgb, white 90%, transparent);
      }

      .block-html :is(p, h1, h2, h3) {
        margin: 0;
      }

      .template-block.headline .block-html,
      .template-block.subheadline .block-html {
        font-family: var(--font-heading, 'Instrument Serif', serif);
        text-wrap: balance;
      }

      .template-block.headline .block-html {
        font-size: clamp(1.55rem, 2.4vw, 2.4rem);
        line-height: 0.96;
      }

      .template-block.subheadline .block-html {
        font-size: 1.05rem;
        line-height: 1.2;
      }

      .template-block.body .block-html,
      .template-block.contact .block-html {
        line-height: 1.6;
        color: color-mix(in srgb, white 76%, transparent);
      }

      .template-block.cta .block-html {
        display: inline-flex;
        width: fit-content;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        color: #081018;
        background: color-mix(in srgb, var(--asset-accent, #34d399) 82%, white);
        font-weight: 700;
      }

      .print-flyer {
        box-shadow: inset 0 0 0 1px color-mix(in srgb, white 8%, transparent);
      }

      .print-brochure .template-body {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .print-business-card {
        min-height: 12rem;
      }

      .web-display-ad,
      .web-landing-promo {
        min-height: 14rem;
      }

      .web-display-ad.announcement-strip,
      .web-display-ad.headline-strip {
        min-height: 10rem;
        align-content: center;
      }

      @media (max-width: 860px) {
        .print-brochure .template-body {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MaterialTemplatePreviewComponent {
  readonly asset = input.required<CampaignAsset>();
  readonly surface = input.required<MaterialSurface>();

  readonly previewClasses = computed(() => [
    this.asset().templateFamily || this.fallbackFamily(),
    this.asset().templateName || this.asset().layoutVariant,
  ]);

  normalizeBlockValue(value: string): string {
    const trimmed = value.trim();
    return this.looksLikeHtml(trimmed)
      ? trimmed
      : `<p>${this.escapeHtml(trimmed)}</p>`;
  }

  private fallbackFamily(): string {
    switch (this.asset().type) {
      case 'flyer':
        return 'print-flyer';
      case 'brochure':
        return 'print-brochure';
      case 'business-card':
        return 'print-business-card';
      case 'web-ad':
        return 'web-display-ad';
    }
  }

  private looksLikeHtml(value: string): boolean {
    return /^<(?:(?:[A-Za-z][\w:-]*)|\/(?:[A-Za-z][\w:-]*)|!DOCTYPE|!--)/.test(
      value
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
