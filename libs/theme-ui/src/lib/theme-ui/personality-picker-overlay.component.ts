import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';

export type PersonalityPickerOverlayState = 'loading' | 'error' | 'ready';

interface IsolationRecord {
  owners: Set<HTMLElement>;
  inert: string | null;
  ariaHidden: string | null;
}

const activePortals = new Set<HTMLElement>();
const isolationRecords = new Map<HTMLElement, IsolationRecord>();
const scrollLockOwners = new Set<HTMLElement>();
let scrollLockRecord: { htmlOverflow: string; bodyOverflow: string } | null =
  null;

export interface PersonalityPickerOverlayContract {
  state: PersonalityPickerOverlayState;
  dialogId: string;
  titleId: string;
  pickerHost: ViewContainerRef;
  retry: EventEmitter<void>;
  closed: EventEmitter<void>;
  focusFirstElement(): void;
}

@Component({
  selector: 'lib-personality-picker-overlay',
  standalone: true,
  template: `
    <div class="personality-picker-shell" (click)="onBackdropClick($event)">
      <section
        #dialog
        class="personality-picker-dialog"
        [id]="dialogId"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
        (keydown)="onDialogKeydown($event)"
        (click)="$event.stopPropagation()"
      >
        @if (state === 'loading' || state === 'error') {
        <div class="personality-picker-status-header">
          <h2 [id]="titleId">Choose Your Style</h2>
          <button
            type="button"
            class="personality-picker-status-close"
            (click)="closed.emit()"
          >
            Close
          </button>
        </div>
        @if (state === 'loading') {
        <p
          class="personality-picker-status-message"
          role="status"
          aria-live="polite"
        >
          Loading styles&hellip;
        </p>
        } @else {
        <div class="personality-picker-status-message" role="alert">
          <p>Styles could not be loaded.</p>
          <button type="button" (click)="retry.emit()">Try again</button>
        </div>
        } }

        <ng-template #pickerHost></ng-template>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: var(--z-index-overlay, 1080);
        display: grid;
        place-items: center;
        padding: 1rem;
        box-sizing: border-box;
        inline-size: 100%;
        block-size: 100%;
        overflow: hidden;
      }

      .personality-picker-shell {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: inherit;
        box-sizing: border-box;
        overflow: hidden;
        background: var(--background-overlay, #00000080);
        backdrop-filter: blur(2px);
      }

      .personality-picker-dialog {
        position: relative;
        width: min(500px, calc(100vw - 2rem));
        max-width: 100%;
        height: min(80vh, calc(100vh - 2rem));
        height: min(80dvh, calc(100dvh - 2rem));
        max-height: calc(100vh - 2rem);
        max-height: calc(100dvh - 2rem);
        min-height: 0;
        display: flex;
        flex-direction: column;
        outline: none;
      }

      .personality-picker-dialog > lib-personality-picker-host {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        max-height: 100%;
        min-width: 0;
      }

      .personality-picker-status-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius-lg, 12px)
          var(--border-radius-lg, 12px) 0 0;
        background: var(--primary);
        color: var(--primary-foreground, #ffffff);
      }

      .personality-picker-status-header h2 {
        margin: 0;
        font-size: 1.25rem;
      }

      .personality-picker-status-close,
      .personality-picker-status-message button {
        min-height: 2.75rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid currentColor;
        border-radius: var(--border-radius-sm, 4px);
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
      }

      .personality-picker-status-message {
        margin: 0;
        padding: 1.5rem;
        border-radius: 0 0 var(--border-radius-lg, 12px)
          var(--border-radius-lg, 12px);
        background: var(--surface, var(--background));
        color: var(--foreground);
      }

      .personality-picker-status-message p {
        margin: 0 0 1rem;
      }
    `,
  ],
})
export class PersonalityPickerOverlayComponent
  implements AfterViewInit, PersonalityPickerOverlayContract
{
  @Input() state: PersonalityPickerOverlayState = 'loading';
  @Input() dialogId = '';
  @Input() titleId = '';
  @Output() retry = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog', { static: true })
  private dialog?: ElementRef<HTMLElement>;
  @ViewChild('pickerHost', { read: ViewContainerRef, static: true })
  pickerHost!: ViewContainerRef;

  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private isolatedElements: HTMLElement[] = [];

  ngAfterViewInit(): void {
    this.isolatedElements = isolateBackground(this.hostElement.nativeElement);
    lockPageScroll(this.hostElement.nativeElement);
    queueMicrotask(() => this.focusFirstElement());
  }

  ngOnDestroy(): void {
    restorePageScroll(this.hostElement.nativeElement);
    restoreBackground(this.hostElement.nativeElement, this.isolatedElements);
    this.isolatedElements = [];
  }

  focusFirstElement(): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog?.isConnected) {
      return;
    }

    const firstElement = this.getFocusableElements(dialog)[0];
    (firstElement ?? dialog).focus();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      this.closed.emit();
    }
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = this.dialog?.nativeElement;
    if (!dialog) {
      return;
    }

    const focusable = this.getFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const activeElement = document.activeElement;
    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      (activeElement === firstElement || !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === lastElement || !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private getFocusableElements(dialog: HTMLElement): HTMLElement[] {
    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ')
      )
    );
  }
}

function isolateBackground(portalHost: HTMLElement): HTMLElement[] {
  if (typeof document === 'undefined' || !document.body) {
    return [];
  }

  activePortals.add(portalHost);
  const isolatedElements: HTMLElement[] = [];
  for (const element of Array.from(document.body.children) as HTMLElement[]) {
    if (element === portalHost || activePortals.has(element)) {
      continue;
    }

    let record = isolationRecords.get(element);
    if (!record) {
      record = {
        owners: new Set<HTMLElement>(),
        inert: element.getAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      };
      isolationRecords.set(element, record);
    }
    record.owners.add(portalHost);
    element.setAttribute('inert', '');
    element.setAttribute('aria-hidden', 'true');
    isolatedElements.push(element);
  }

  return isolatedElements;
}

function restoreBackground(
  portalHost: HTMLElement,
  isolatedElements: HTMLElement[]
): void {
  activePortals.delete(portalHost);
  for (const element of isolatedElements) {
    const record = isolationRecords.get(element);
    if (!record) {
      continue;
    }

    record.owners.delete(portalHost);
    if (record.owners.size > 0) {
      continue;
    }

    if (record.inert === null) {
      element.removeAttribute('inert');
    } else {
      element.setAttribute('inert', record.inert);
    }
    if (record.ariaHidden === null) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', record.ariaHidden);
    }
    isolationRecords.delete(element);
  }
}

function lockPageScroll(portalHost: HTMLElement): void {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  if (scrollLockOwners.size === 0) {
    scrollLockRecord = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body?.style.overflow ?? '',
    };
    document.documentElement.style.overflow = 'hidden';
    if (document.body) {
      document.body.style.overflow = 'hidden';
    }
  }
  scrollLockOwners.add(portalHost);
}

function restorePageScroll(portalHost: HTMLElement): void {
  scrollLockOwners.delete(portalHost);
  if (scrollLockOwners.size > 0 || !scrollLockRecord) {
    return;
  }

  document.documentElement.style.overflow = scrollLockRecord.htmlOverflow;
  if (document.body) {
    document.body.style.overflow = scrollLockRecord.bodyOverflow;
  }
  scrollLockRecord = null;
}
