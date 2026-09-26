import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'otui-totp-challenge-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="totp-modal-backdrop">
      <div
        #modalCard
        class="totp-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="totp-modal-title"
      >
        <div class="totp-modal-header">
          <div class="shield-icon">
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
          <div>
            <h3 class="totp-modal-title" id="totp-modal-title">{{ title }}</h3>
            <p class="totp-modal-subtitle">ALTA Pillar 3 Wire Fraud Defense</p>
          </div>
        </div>

        <div class="totp-modal-body">
          <div class="warning-callout">
            <p>
              Wire instructions are encrypted. Enter the rolling 6-digit
              verification code sent to your registered device to decrypt wiring
              details.
            </p>
            <div *ngIf="beneficiary" class="escrow-meta">
              <span
                >Beneficiary: <strong>{{ beneficiary }}</strong></span
              >
              <span *ngIf="escrowReference">Ref: {{ escrowReference }}</span>
            </div>
          </div>

          <div
            class="digit-inputs-row"
            role="group"
            aria-label="Six digit verification code"
          >
            <input
              #digitInput
              *ngFor="let digit of digits; let i = index"
              type="text"
              maxlength="1"
              inputmode="numeric"
              pattern="[0-9]*"
              class="digit-input"
              [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
              [value]="digits[i]"
              (input)="onDigitInput($event, i)"
              (keydown)="onKeyDown($event, i)"
              (paste)="onPaste($event)"
              [disabled]="validating"
            />
          </div>

          <div *ngIf="errorMessage" class="error-banner" role="alert">
            {{ errorMessage }}
          </div>

          <div class="rolling-timer">
            <div
              class="timer-progress"
              [style.width.%]="(remainingSeconds / totalSeconds) * 100"
            ></div>
            <span class="timer-label" role="status" aria-live="polite">
              Code refreshes in {{ remainingSeconds }}s
            </span>
          </div>
        </div>

        <div class="totp-modal-actions">
          <button
            type="button"
            class="btn-cancel"
            (click)="onClose()"
            [disabled]="validating"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-verify"
            (click)="submitCode()"
            [disabled]="!isCodeComplete() || validating"
          >
            <span *ngIf="!validating">Verify and Decrypt</span>
            <span *ngIf="validating">Validating...</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .totp-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
      }
      .totp-modal-card {
        background: #0f172a;
        border: 1px solid rgba(56, 189, 248, 0.3);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.5);
        border-radius: 12px;
        width: 100%;
        max-width: 480px;
        padding: 24px;
        color: #f8fafc;
      }
      .totp-modal-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 20px;
      }
      .shield-icon {
        background: rgba(56, 189, 248, 0.1);
        padding: 10px;
        border-radius: 8px;
        display: flex;
      }
      .totp-modal-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #f8fafc;
      }
      .totp-modal-subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8rem;
        color: #38bdf8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .warning-callout {
        background: rgba(30, 41, 59, 0.8);
        border-left: 3px solid #38bdf8;
        padding: 12px 14px;
        border-radius: 4px;
        font-size: 0.875rem;
        color: #cbd5e1;
        margin-bottom: 20px;
      }
      .warning-callout p {
        margin: 0 0 8px 0;
      }
      .escrow-meta {
        display: flex;
        gap: 16px;
        font-size: 0.8rem;
        color: #94a3b8;
      }
      .digit-inputs-row {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 20px;
      }
      .digit-input {
        width: 48px;
        height: 56px;
        text-align: center;
        font-size: 1.5rem;
        font-weight: 700;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(15, 23, 42, 0.9);
        color: #38bdf8;
        outline: none;
        transition: all 0.15s ease;
      }
      .digit-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
      }
      .error-banner {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 0.85rem;
        margin-bottom: 16px;
        text-align: center;
      }
      .rolling-timer {
        background: rgba(30, 41, 59, 0.5);
        height: 20px;
        border-radius: 10px;
        position: relative;
        overflow: hidden;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .timer-progress {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background: rgba(56, 189, 248, 0.35);
        transition: width 1s linear;
      }
      .timer-label {
        position: relative;
        font-size: 0.75rem;
        color: #94a3b8;
        font-weight: 500;
      }
      .totp-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .btn-cancel {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #cbd5e1;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      }
      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .btn-verify {
        background: #0284c7;
        border: none;
        color: #ffffff;
        padding: 8px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s ease;
      }
      .btn-verify:hover:not(:disabled) {
        background: #0369a1;
      }
      .btn-verify:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class TotpChallengeModalComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input() isOpen = false;
  @Input() title = 'Escrow Wire Shield Verification';
  @Input() beneficiary = '';
  @Input() escrowReference = '';
  @Input() validating = false;
  @Input() errorMessage = '';
  @Input() totalSeconds = 60;

  @Output() otpSubmitted = new EventEmitter<string>();
  @Output() modalClosed = new EventEmitter<void>();

  @ViewChildren('digitInput') digitInputs!: QueryList<
    ElementRef<HTMLInputElement>
  >;
  @ViewChild('modalCard') modalCard!: ElementRef<HTMLElement>;

  digits: string[] = ['', '', '', '', '', ''];
  remainingSeconds = 60;
  private timerInterval?: ReturnType<typeof setInterval>;
  private previouslyFocused: HTMLElement | null = null;
  private readonly trapListener = (event: KeyboardEvent): void => {
    this.onTrapKey(event);
  };

  ngOnInit(): void {
    this.remainingSeconds = this.totalSeconds;
    this.startTimer();
    if (this.isOpen) {
      this.onOpened();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (changes['isOpen'].currentValue === true) {
        this.onOpened();
      } else {
        this.onClosed();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    document.removeEventListener('keydown', this.trapListener, true);
  }

  private onOpened(): void {
    this.previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.addEventListener('keydown', this.trapListener, true);
    setTimeout(() => {
      const first = this.digitInputs?.toArray()[0]?.nativeElement;
      if (first && !first.disabled) {
        first.focus();
      }
    });
  }

  private onClosed(): void {
    document.removeEventListener('keydown', this.trapListener, true);
    if (this.previouslyFocused && document.contains(this.previouslyFocused)) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;
  }

  private onTrapKey(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
      return;
    }
    if (event.key !== 'Tab' || !this.modalCard?.nativeElement) {
      return;
    }
    const focusable = Array.from(
      this.modalCard.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 1) {
        this.remainingSeconds--;
      } else {
        this.remainingSeconds = this.totalSeconds;
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^0-9]/g, '');
    this.digits[index] = val ? val[val.length - 1] : '';

    if (this.digits[index] && index < 5) {
      const nextInput = this.digitInputs.toArray()[index + 1]?.nativeElement;
      if (nextInput) nextInput.focus();
    }

    if (this.isCodeComplete()) {
      this.submitCode();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prevInput = this.digitInputs.toArray()[index - 1]?.nativeElement;
      if (prevInput) {
        prevInput.focus();
        this.digits[index - 1] = '';
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const numeric = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (!numeric) return;

    for (let i = 0; i < 6; i++) {
      this.digits[i] = numeric[i] || '';
    }

    const lastIdx = Math.min(numeric.length - 1, 5);
    const targetInput = this.digitInputs.toArray()[lastIdx]?.nativeElement;
    if (targetInput) targetInput.focus();

    if (this.isCodeComplete()) {
      this.submitCode();
    }
  }

  isCodeComplete(): boolean {
    return this.digits.every((d) => d.length === 1);
  }

  submitCode(): void {
    if (this.isCodeComplete() && !this.validating) {
      this.otpSubmitted.emit(this.digits.join(''));
    }
  }

  onClose(): void {
    this.modalClosed.emit();
  }
}
