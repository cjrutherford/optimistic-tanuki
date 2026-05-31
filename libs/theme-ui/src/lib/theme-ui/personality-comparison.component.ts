/**
 * Personality Comparison Component
 *
 * Renders the same set of UI primitives (button, card, input) once per
 * selected personality so reviewers and marketers can see the design
 * system's distinctiveness at a glance.
 *
 * Used by:
 *  - the personality showcase Storybook stories in this library
 *  - marketing material that needs an interactive "five personalities,
 *    same component" comparison
 *
 * The comparison is purely visual. It does **not** mutate the global
 * theme; it scopes each column with `data-personality` and inline CSS
 * variables sourced from the personality's presentation contract so the
 * surrounding application's active personality is unaffected.
 */

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';
import {
  PREDEFINED_PERSONALITIES,
  PRODUCT_DESCRIPTORS,
  Personality,
  getPersonalityById,
} from '@optimistic-tanuki/theme-models';

type ComparisonPrimitive = 'button' | 'card' | 'input' | 'all';

@Component({
  selector: 'otui-personality-comparison',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="comparison" [attr.aria-label]="ariaLabel">
      <header class="comparison__header">
        <h3>{{ heading }}</h3>
        <p class="comparison__subtitle">
          Same UI primitives rendered under
          {{ columns().length }} personalities. Switch personalities at runtime;
          products only declare their canonical default.
        </p>
      </header>

      <div class="comparison__grid" role="list">
        <article
          *ngFor="let column of columns(); trackBy: trackById"
          class="comparison__column"
          role="listitem"
          [attr.data-personality]="column.personality.id"
          [style]="column.cssVars"
        >
          <header class="comparison__column-header">
            <h4>{{ column.personality.name }}</h4>
            <p class="comparison__column-meta">
              <code>{{ column.personality.id }}</code>
              <span *ngIf="column.product"> · {{ column.product }}</span>
            </p>
            <p class="comparison__column-description">
              {{ column.personality.description }}
            </p>
          </header>

          <div class="comparison__samples">
            <ng-container *ngIf="showButton">
              <div class="comparison__sample">
                <span class="comparison__sample-label">Button</span>
                <button
                  type="button"
                  class="comparison__button"
                  [ngStyle]="column.buttonStyle"
                >
                  Take action
                </button>
              </div>
            </ng-container>

            <ng-container *ngIf="showCard">
              <div class="comparison__sample">
                <span class="comparison__sample-label">Card</span>
                <div class="comparison__card" [ngStyle]="column.cardStyle">
                  <strong>{{ column.personality.name }} card</strong>
                  <p>
                    The personality reshapes border radius, padding, shadow,
                    typography weight and animation timing — not just color.
                  </p>
                </div>
              </div>
            </ng-container>

            <ng-container *ngIf="showInput">
              <div class="comparison__sample">
                <span class="comparison__sample-label">Input</span>
                <input
                  type="text"
                  class="comparison__input"
                  placeholder="Type something…"
                  [ngStyle]="column.inputStyle"
                />
              </div>
            </ng-container>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .comparison__header {
        margin-bottom: 1.5rem;
      }

      .comparison__header h3 {
        margin: 0 0 0.25rem;
        font-size: 1.25rem;
      }

      .comparison__subtitle {
        margin: 0;
        color: var(--muted, #64748b);
        font-size: 0.9rem;
      }

      .comparison__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }

      .comparison__column {
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 12px;
        padding: 1rem;
        background: var(--surface, #ffffff);
        display: flex;
        flex-direction: column;
        gap: 1rem;
        font-family: var(--personality-body-family, inherit);
      }

      .comparison__column-header h4 {
        margin: 0;
        font-family: var(--personality-heading-family, inherit);
        font-weight: var(--personality-font-weight, 600);
      }

      .comparison__column-meta {
        margin: 0.25rem 0 0.5rem;
        font-size: 0.8rem;
        color: var(--muted, #64748b);
      }

      .comparison__column-meta code {
        background: rgba(0, 0, 0, 0.06);
        padding: 1px 6px;
        border-radius: 4px;
      }

      .comparison__column-description {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.45;
        color: var(--foreground, #0f172a);
      }

      .comparison__samples {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .comparison__sample {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .comparison__sample-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted, #64748b);
      }

      .comparison__button {
        background: var(--primary, #3f51b5);
        color: var(--primary-foreground, #fff);
        border: none;
        cursor: pointer;
        align-self: flex-start;
      }

      .comparison__card {
        background: var(--surface, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
      }

      .comparison__card strong {
        display: block;
        margin-bottom: 0.25rem;
      }

      .comparison__card p {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.4;
      }

      .comparison__input {
        background: var(--background, #ffffff);
        color: var(--foreground, #0f172a);
        border-style: solid;
        border-color: var(--border, #cbd5f5);
        padding: 0.5rem 0.75rem;
        font: inherit;
      }
    `,
  ],
})
export class PersonalityComparisonComponent {
  /** Heading rendered above the grid. */
  @Input() heading = 'Personality Comparison';

  /** Accessibility label for the wrapping region. */
  @Input() ariaLabel = 'Personality comparison grid';

  /** Which primitive to render. `all` (default) renders button, card, input. */
  @Input() set primitive(value: ComparisonPrimitive) {
    this._primitive.set(value);
  }
  get primitive(): ComparisonPrimitive {
    return this._primitive();
  }

  /**
   * Optional explicit list of personality ids. When omitted, the
   * canonical mapping in `PRODUCT_DESCRIPTORS` is used so the grid
   * mirrors the product portfolio.
   */
  @Input() set personalities(ids: string[] | null | undefined) {
    this._explicitIds.set(ids ?? null);
  }
  get personalities(): string[] | null {
    return this._explicitIds();
  }

  private readonly _primitive = signal<ComparisonPrimitive>('all');
  private readonly _explicitIds = signal<string[] | null>(null);

  protected readonly columns = computed(() => {
    const explicit = this._explicitIds();
    if (explicit && explicit.length) {
      return explicit
        .map((id) => ({
          personality: getPersonalityById(id),
          product: undefined as string | undefined,
        }))
        .filter(
          (
            entry
          ): entry is {
            personality: Personality;
            product: string | undefined;
          } => !!entry.personality
        )
        .map((entry) => this.buildColumn(entry.personality, entry.product));
    }

    return PRODUCT_DESCRIPTORS.map((descriptor) => {
      const personality =
        getPersonalityById(descriptor.personalityId) ??
        PREDEFINED_PERSONALITIES[0];
      return this.buildColumn(personality, descriptor.name);
    });
  });

  protected get showButton(): boolean {
    const p = this._primitive();
    return p === 'button' || p === 'all';
  }
  protected get showCard(): boolean {
    const p = this._primitive();
    return p === 'card' || p === 'all';
  }
  protected get showInput(): boolean {
    const p = this._primitive();
    return p === 'input' || p === 'all';
  }

  protected trackById(
    _index: number,
    column: { personality: Personality }
  ): string {
    return column.personality.id;
  }

  private buildColumn(personality: Personality, product: string | undefined) {
    const components = personality.presentation?.components;
    const button = components?.button;
    const card = components?.card;
    const input = components?.input;
    return {
      personality,
      product,
      cssVars: this.buildCssVars(personality),
      buttonStyle: button
        ? {
            'border-radius': button.borderRadius,
            padding: button.padding,
            'font-weight': button.fontWeight,
            'text-transform': button.textTransform,
          }
        : {},
      cardStyle: card
        ? {
            'border-radius': card.borderRadius,
            padding: card.padding,
            'box-shadow': card.boxShadow,
          }
        : {},
      inputStyle: input
        ? {
            'border-radius': input.borderRadius,
            'border-width': input.borderWidth,
          }
        : {},
    };
  }

  private buildCssVars(personality: Personality): Record<string, string> {
    const presentation = personality.presentation;
    if (!presentation) {
      return {};
    }
    return {
      '--personality-heading-family':
        presentation.typography.headingFamilyValue,
      '--personality-body-family': presentation.typography.bodyFamilyValue,
      '--personality-font-weight': presentation.typography.weightValue,
      '--personality-border-radius': presentation.layout.borderRadius,
      '--personality-card-shadow': presentation.shadow.value,
    } as Record<string, string>;
  }
}
