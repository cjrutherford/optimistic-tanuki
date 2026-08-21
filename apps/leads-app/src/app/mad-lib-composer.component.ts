import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type {
  MadLibComposition,
  MadLibField,
  MadLibSlotSegment,
  MadLibTemplate,
  OnboardingProfileSuggestions,
} from '@optimistic-tanuki/models';
import { DEFAULT_MAD_LIB_TEMPLATE } from './mad-lib-template';

/**
 * Renders the intro scaffold as always-visible prose with editable slots.
 *
 * The previous step was a single textarea whose scaffold lived in the
 * placeholder, so it disappeared as soon as the user typed and the backend had
 * to regex-mine the resulting paragraph. Here each slot binds to exactly one
 * onboarding field, so the answers arrive already structured.
 */
@Component({
  selector: 'app-mad-lib-composer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <p class="mad-lib" [attr.aria-label]="'Introduction builder'">
      <ng-container *ngFor="let segment of template.segments; let i = index">
        <!--
          Punctuation is its own span with no leading gap, so a full stop hugs
          the slot it closes instead of drifting a space away from it. Without
          this the sentence reads "...faster releases . I do that using".
        -->
        <span
          class="lit"
          *ngIf="segment.kind === 'text'"
          [class.punct]="isPunctuation(segment)"
          >{{ segment.text }}</span
        >

        <ng-container *ngIf="segment.kind === 'slot'">
          <ng-container [ngSwitch]="asSlot(segment).slotType">
            <!-- one short free-text value -->
            <span class="slot" *ngSwitchCase="'inline'">
              <input
                type="text"
                [id]="slotId(asSlot(segment), i)"
                [attr.aria-label]="asSlot(segment).label"
                [ngModel]="textValue(asSlot(segment).field)"
                (ngModelChange)="setText(asSlot(segment).field, $event)"
                [placeholder]="asSlot(segment).placeholder"
                [size]="inputSize(asSlot(segment))"
                [class.empty]="!textValue(asSlot(segment).field)"
              />
            </span>

            <!-- one value from a fixed set -->
            <span class="slot" *ngSwitchCase="'choice'">
              <select
                [id]="slotId(asSlot(segment), i)"
                [attr.aria-label]="asSlot(segment).label"
                [ngModel]="textValue(asSlot(segment).field)"
                (ngModelChange)="setText(asSlot(segment).field, $event)"
                [class.empty]="!textValue(asSlot(segment).field)"
              >
                <option value="">{{ asSlot(segment).placeholder }}</option>
                <option
                  *ngFor="let option of asSlot(segment).options"
                  [value]="option"
                >
                  {{ option }}
                </option>
              </select>
            </span>

            <!-- several values ticked from a known set -->
            <span class="slot checkset" *ngSwitchCase="'checkset'">
              <span
                class="check-option"
                *ngFor="let option of asSlot(segment).options; let oi = index"
              >
                <input
                  type="checkbox"
                  [id]="slotId(asSlot(segment), i) + '-' + oi"
                  [checked]="isChecked(asSlot(segment).field, option)"
                  (change)="toggleOption(asSlot(segment).field, option)"
                />
                <label [attr.for]="slotId(asSlot(segment), i) + '-' + oi">{{
                  option
                }}</label>
              </span>
            </span>

            <!-- several values, entered as bullets -->
            <span class="slot list" *ngSwitchCase="'list'">
              <span
                class="chip"
                *ngFor="let item of listValue(asSlot(segment).field)"
              >
                {{ item }}
                <button
                  type="button"
                  [attr.aria-label]="'Remove ' + item"
                  (click)="removeItem(asSlot(segment).field, item)"
                >
                  ×
                </button>
              </span>
              <input
                type="text"
                class="chip-input"
                [size]="chipInputSize(asSlot(segment))"
                [id]="slotId(asSlot(segment), i)"
                [attr.aria-label]="asSlot(segment).label"
                [attr.list]="
                  asSlot(segment).options?.length
                    ? slotId(asSlot(segment), i) + '-options'
                    : null
                "
                [(ngModel)]="drafts[asSlot(segment).field]"
                (keydown)="onListKeydown($event, asSlot(segment).field)"
                (blur)="commitItem(asSlot(segment).field)"
                [placeholder]="
                  listValue(asSlot(segment).field).length
                    ? 'Add another'
                    : asSlot(segment).placeholder
                "
              />
              <datalist
                *ngIf="asSlot(segment).options?.length"
                [id]="slotId(asSlot(segment), i) + '-options'"
              >
                <option
                  *ngFor="let option of asSlot(segment).options"
                  [value]="option"
                ></option>
              </datalist>
            </span>
          </ng-container>
        </ng-container>
      </ng-container>
    </p>

    <p class="composer-hint">
      Each blank maps to one part of your profile, so nothing has to be guessed
      from a paragraph. Lists take several entries — press Enter after each.
    </p>
  `,
  styles: [
    `
      .mad-lib {
        margin: 0;
        font-size: 1.05rem;
        line-height: 2.4;
        color: var(--app-foreground);
      }

      .lit {
        margin-right: 0.3rem;
      }

      /* Cancels the previous element's trailing gap so punctuation sits
         against the word or field it closes. */
      .lit.punct {
        margin-left: -0.3rem;
      }

      .slot.checkset {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.6rem;
        vertical-align: middle;
        margin-right: 0.3rem;
      }

      .check-option {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.1rem 0.5rem 0.1rem 0.35rem;
        border: 1px solid var(--app-border, #d0d7de);
        border-radius: 999px;
        background: var(--app-surface-raised, #f6f8fa);
        font-size: 0.9rem;
        line-height: 1.6;
      }

      .check-option label {
        cursor: pointer;
        white-space: nowrap;
      }

      .check-option input {
        margin: 0;
        cursor: pointer;
      }

      .check-option:has(input:checked) {
        border-color: var(--app-accent, #2e7d62);
        background: color-mix(
          in srgb,
          var(--app-accent, #2e7d62) 12%,
          transparent
        );
      }

      .slot {
        display: inline;
        margin-right: 0.3rem;
      }

      .slot.list {
        display: inline;
      }

      input,
      select {
        font: inherit;
        color: var(--app-primary);
        background: color-mix(in srgb, var(--app-primary) 7%, transparent);
        border: 0;
        border-bottom: 2px solid var(--app-primary);
        border-radius: 0.25rem 0.25rem 0 0;
        padding: 0.1rem 0.4rem;
        min-width: 4rem;
      }

      input.empty,
      select.empty {
        color: var(--app-foreground-muted);
        border-bottom-style: dashed;
        background: transparent;
      }

      input:focus,
      select:focus {
        outline: 2px solid var(--app-primary);
        outline-offset: 2px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.1rem 0.2rem 0.1rem 0.55rem;
        margin-right: 0.25rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--app-primary) 14%, transparent);
        color: var(--app-foreground);
        font-size: 0.92rem;
        line-height: 1.6;
      }

      .chip button {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        padding: 0 0.3rem;
        min-height: 1.5rem;
      }

      /* Sized to its own text via the size attribute. A fixed min-width made
         every empty list slot a wide blank that broke the sentence apart. */
      .chip-input {
        min-width: 0;
      }

      .composer-hint {
        margin: 1rem 0 0;
        color: var(--app-foreground-secondary);
        font-size: 0.88rem;
      }
    `,
  ],
})
export class MadLibComposerComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() template: MadLibTemplate = DEFAULT_MAD_LIB_TEMPLATE;

  /**
   * Slot values known before the user starts typing — in practice whatever the
   * resume told us. Only applied where a slot is still empty, so a prefill
   * never overwrites something the user has already changed.
   */
  @Input() set initialValues(values: OnboardingProfileSuggestions | undefined) {
    if (!values) {
      return;
    }

    for (const [field, value] of Object.entries(values)) {
      const isEmpty = Array.isArray(value)
        ? value.length === 0
        : value === undefined || value === null || value === '';
      if (isEmpty || this.hasValue(field as MadLibField)) {
        continue;
      }
      (this.values as Record<string, unknown>)[field] = Array.isArray(value)
        ? [...value]
        : value;
    }

    this.emit();
  }

  @Output() compositionChange = new EventEmitter<MadLibComposition>();

  /** In-progress text for each list slot, before it is committed as an entry. */
  drafts: Partial<Record<MadLibField, string>> = {};

  private values: OnboardingProfileSuggestions = {};

  private hasValue(field: MadLibField): boolean {
    const current = (this.values as Record<string, unknown>)[field];
    return Array.isArray(current)
      ? current.length > 0
      : current !== undefined && current !== null && current !== '';
  }

  asSlot(segment: unknown): MadLibSlotSegment {
    return segment as MadLibSlotSegment;
  }

  /** True for a segment that is only punctuation, so it renders flush left. */
  isPunctuation(segment: { kind: string; text?: string }): boolean {
    return /^[.,;:!?]+$/.test((segment.text || '').trim());
  }

  isChecked(field: MadLibField, option: string): boolean {
    return this.listValue(field).includes(option);
  }

  toggleOption(field: MadLibField, option: string): void {
    const current = this.listValue(field);
    // Rebuilt in the template's own order rather than click order, so the
    // sentence reads the same however the boxes were ticked.
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];

    (this.values as Record<string, unknown>)[field] = next;
    this.emit();
  }

  slotId(slot: MadLibSlotSegment, index: number): string {
    return `madlib-${slot.field}-${index}`;
  }

  /**
   * Width of a list slot's entry box.
   *
   * Once a slot has chips the box is only there to add the next one, so it
   * shrinks to its prompt. Left at a fixed width it opened a gap wide enough
   * to read as a missing answer mid-sentence.
   */
  chipInputSize(slot: MadLibSlotSegment): number {
    const draft = this.drafts[slot.field] || '';
    const prompt = this.listValue(slot.field).length
      ? 'Add another'
      : slot.placeholder;
    return Math.max(6, Math.min((draft || prompt).length + 1, 32));
  }

  inputSize(slot: MadLibSlotSegment): number {
    const current = this.textValue(slot.field);
    const basis = current || slot.placeholder;
    return Math.max(8, Math.min(basis.length + 2, 42));
  }

  textValue(field: MadLibField): string {
    const value = (this.values as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : '';
  }

  listValue(field: MadLibField): string[] {
    const value = (this.values as Record<string, unknown>)[field];
    return Array.isArray(value) ? (value as string[]) : [];
  }

  setText(field: MadLibField, value: string): void {
    (this.values as Record<string, unknown>)[field] = value;
    this.emit();
  }

  onListKeydown(event: KeyboardEvent, field: MadLibField): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitItem(field);
      return;
    }

    if (
      event.key === 'Backspace' &&
      !(this.drafts[field] || '') &&
      this.listValue(field).length
    ) {
      const items = this.listValue(field);
      this.removeItem(field, items[items.length - 1]);
    }
  }

  commitItem(field: MadLibField): void {
    const draft = (this.drafts[field] || '').trim();
    if (!draft) {
      return;
    }

    const current = this.listValue(field);
    if (!current.includes(draft)) {
      (this.values as Record<string, unknown>)[field] = [...current, draft];
    }
    this.drafts[field] = '';
    this.emit();
  }

  removeItem(field: MadLibField, item: string): void {
    (this.values as Record<string, unknown>)[field] = this.listValue(
      field
    ).filter((value) => value !== item);
    this.emit();
  }

  /** Exposed for the host so it can seed or reset the composer. */
  reset(): void {
    this.values = {};
    this.drafts = {};
    this.emit();
  }

  private emit(): void {
    this.compositionChange.emit(this.buildComposition());
    this.cdr.detectChanges();
  }

  private buildComposition(): MadLibComposition {
    const unfilledFields: MadLibField[] = [];
    const filled: OnboardingProfileSuggestions = {};
    let sentence = '';

    for (const segment of this.template.segments) {
      if (segment.kind === 'text') {
        // Punctuation closes the preceding clause, so it joins with no space;
        // everything else starts a new word and needs one. Keying off the
        // segment rather than what the sentence already ends with is what
        // stops "faster releases.I do that using".
        sentence += this.isPunctuation(segment)
          ? segment.text
          : `${sentence ? ' ' : ''}${segment.text}`;
        continue;
      }

      const slot = segment;
      // Both multi-value kinds read out as a list; only how they are entered
      // differs, so they must be collected the same way here.
      const isMultiValue =
        slot.slotType === 'list' || slot.slotType === 'checkset';
      const rendered = isMultiValue
        ? this.joinList(this.listValue(slot.field))
        : this.textValue(slot.field);

      if (rendered) {
        (filled as Record<string, unknown>)[slot.field] = isMultiValue
          ? this.listValue(slot.field)
          : this.textValue(slot.field);
        sentence += ` ${rendered}`;
      } else {
        if (!slot.optional) {
          unfilledFields.push(slot.field);
        }
        // Keep the scaffold readable where a slot is still blank.
        sentence += ` [${slot.label.toLowerCase()}]`;
      }
    }

    return {
      sentence: sentence.replace(/\s+([.,])/g, '$1').trim(),
      values: filled,
      unfilledFields,
    };
  }

  private joinList(items: string[]): string {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }
}
