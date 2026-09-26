import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TotpChallengeModalComponent } from '@optimistic-tanuki/common-ui';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';
import { WireInstructionResponseDto } from '@optimistic-tanuki/models';

@Component({
  selector: 'vault-escrow-verify-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TotpChallengeModalComponent,
  ],
  template: `
    <div class="escrow-page-container">
      <div class="page-header">
        <h1 class="page-title">Escrow wire verification</h1>
        <p class="page-lead">
          ALTA Pillar 3 Wire Fraud Defense protocol. Real estate closing wire
          instructions remain AES-256-GCM encrypted until verified via a
          time-locked rolling 6-digit TOTP security code.
        </p>
        <div class="statutory-callout">
          <span class="shield-badge">ALTA Pillar 3</span>
          <span class="shield-badge">ABA Formal Opinion 483</span>
          <span class="shield-badge">Time-locked TOTP</span>
        </div>
      </div>

      <!-- Locked State Card -->
      <div *ngIf="!wireDetails" class="wire-locked-card">
        <div class="lock-graphic">
          <div class="lock-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 class="locked-title">Wire instructions encrypted</h2>
          <p class="locked-desc">
            To prevent business email compromise (BEC) and escrow diversion
            fraud, wire instructions require multi-factor rolling TOTP
            authorization for token:
            <strong class="token-highlight">{{ token }}</strong
            >.
          </p>
        </div>

        <div class="verification-banner">
          <strong>VERIFICATION REQUIRED:</strong> Wire instructions remain
          encrypted and require a rolling 6-digit TOTP challenge (sent to your
          registered device) before reveal. This protects against business email
          compromise and escrow diversion fraud under ALTA Pillar 3 Wire Fraud
          Defense protocol.
        </div>

        <div
          class="callback-banner"
          role="note"
          aria-label="Verbal verification instruction"
        >
          <strong class="callback-title">CALL BEFORE YOU WIRE</strong>
          <p class="callback-text">
            Never send funds based on emailed wire instructions alone. After the
            details are revealed, verbally confirm every routing and account
            number with your settlement officer at a phone number you already
            trust, before authorizing any transfer. Do not call a number printed
            in these instructions.
          </p>
        </div>

        <div class="manual-input-section">
          <label class="input-label" for="otpInput"
            >Enter 6-digit rolling code</label
          >
          <div class="input-row">
            <input
              id="otpInput"
              type="text"
              class="otp-input"
              maxlength="6"
              inputmode="numeric"
              placeholder="Enter code from your authenticator"
              [(ngModel)]="manualOtp"
              [disabled]="!token || isValidating"
            />
            <button
              type="button"
              class="btn-decrypt"
              [disabled]="!token || manualOtp.length !== 6 || isValidating"
              (click)="submitOtp(manualOtp)"
            >
              <span *ngIf="!isValidating">Decrypt wire details</span>
              <span *ngIf="isValidating">Validating...</span>
            </button>
            <button
              type="button"
              class="btn-open-modal"
              [disabled]="!token || isValidating"
              (click)="isModalOpen = true"
            >
              Launch TOTP modal
            </button>
          </div>
        </div>

        <div class="manual-input-section sms-section">
          <label class="input-label" for="smsPhone"
            >No authenticator? Request a one-time SMS code</label
          >
          <div class="input-row">
            <input
              id="smsPhone"
              type="tel"
              class="otp-input sms-input"
              placeholder="+1 912 555 0100"
              [(ngModel)]="smsPhone"
              [disabled]="!token || isRequestingSms"
            />
            <button
              type="button"
              class="btn-open-modal"
              [disabled]="!token || !smsPhone.trim() || isRequestingSms"
              (click)="requestSmsCode()"
            >
              <span *ngIf="!isRequestingSms">Text me a code</span>
              <span *ngIf="isRequestingSms">Sending...</span>
            </button>
          </div>
          <p *ngIf="smsStatus" class="sms-status" role="status">
            {{ smsStatus }}
          </p>
        </div>

        <div *ngIf="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>
      </div>

      <!-- Decrypted Instructions Card -->
      <div *ngIf="wireDetails" class="wire-revealed-card">
        <div class="revealed-header">
          <div class="unlocked-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          </div>
          <div>
            <h2 class="revealed-title">Verified escrow wire instructions</h2>
            <p class="revealed-subtitle">
              Decrypted via ALTA Pillar 3 time-locked rolling OTP verification.
            </p>
          </div>
        </div>

        <div class="wire-grid">
          <div class="wire-item">
            <span class="wire-label">Beneficiary name</span>
            <span class="wire-value beneficiary-val">{{
              wireDetails.beneficiary
            }}</span>
          </div>
          <div class="wire-item">
            <span class="wire-label">Bank name</span>
            <span class="wire-value">{{ wireDetails.bankName }}</span>
          </div>
          <div class="wire-item">
            <span class="wire-label">Routing number (ABA)</span>
            <span class="wire-value code-val">{{
              wireDetails.routingNumber
            }}</span>
          </div>
          <div class="wire-item">
            <span class="wire-label">Account number</span>
            <span class="wire-value code-val">{{
              wireDetails.accountNumber
            }}</span>
          </div>
          <div class="wire-item">
            <span class="wire-label">Escrow reference code</span>
            <span class="wire-value code-val">{{ wireDetails.reference }}</span>
          </div>
          <div class="wire-item">
            <span class="wire-label">Verified timestamp</span>
            <span class="wire-value">{{
              wireDetails.verifiedAt | date : 'medium'
            }}</span>
          </div>
        </div>

        <div class="revealed-footer">
          <span class="compliance-note">{{
            wireDetails.complianceNotice
          }}</span>
          <button type="button" class="btn-lock-again" (click)="lockWire()">
            Re-encrypt instructions
          </button>
        </div>
      </div>
    </div>

    <!-- Reusable TOTP Challenge Modal -->
    <otui-totp-challenge-modal
      [isOpen]="isModalOpen"
      title="Escrow Wire Shield Verification"
      [beneficiary]="wireDetails?.beneficiary ?? ''"
      [escrowReference]="wireDetails?.reference ?? token"
      [validating]="isValidating"
      [errorMessage]="errorMessage"
      (otpSubmitted)="submitOtp($event)"
      (modalClosed)="isModalOpen = false"
    ></otui-totp-challenge-modal>
  `,
  styles: [
    `
      .escrow-page-container {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .page-header {
        margin-bottom: 32px;
      }
      .page-title {
        font-size: 2rem;
        font-weight: 800;
        color: #f8fafc;
        margin: 0 0 10px 0;
        letter-spacing: -0.02em;
      }
      .page-lead {
        font-size: 1rem;
        line-height: 1.6;
        color: #94a3b8;
        margin: 0 0 16px 0;
      }
      .statutory-callout {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .shield-badge {
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.35);
        color: #7dd3fc;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 4px;
      }
      .wire-locked-card {
        background: #0b1120;
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 12px;
        padding: 40px 32px;
        text-align: center;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
      }
      .lock-graphic {
        max-width: 540px;
        margin: 0 auto 32px auto;
      }
      .lock-icon {
        background: rgba(56, 189, 248, 0.1);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px auto;
        border: 1px solid rgba(56, 189, 248, 0.3);
      }
      .locked-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #f8fafc;
        margin: 0 0 12px 0;
      }
      .locked-desc {
        font-size: 0.95rem;
        color: #94a3b8;
        line-height: 1.6;
        margin: 0;
      }
      .token-highlight {
        color: #38bdf8;
        font-family: monospace;
      }
      .manual-input-section {
        max-width: 480px;
        margin: 0 auto;
        text-align: left;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 20px;
      }
      .input-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #94a3b8;
        margin-bottom: 8px;
      }
      .input-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .otp-input {
        flex: 1;
        min-width: 140px;
        background: #090d16;
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 6px;
        padding: 10px 14px;
        color: #38bdf8;
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-align: center;
        outline: none;
      }
      .otp-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
      }
      .btn-decrypt {
        background: #0284c7;
        color: #ffffff;
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .btn-decrypt:hover:not(:disabled) {
        background: #0369a1;
      }
      .btn-decrypt:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-open-modal {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 10px 14px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .btn-open-modal:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .sms-section {
        margin-top: 16px;
      }
      .sms-input {
        font-size: 1rem;
        letter-spacing: normal;
      }
      .sms-status {
        margin: 12px 0 0 0;
        font-size: 0.85rem;
        color: #7dd3fc;
      }
      .error-banner {
        margin-top: 20px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 0.9rem;
        text-align: left;
      }
      .verification-banner {
        margin-top: 24px;
        background: rgba(234, 179, 8, 0.12);
        border: 1px solid rgba(234, 179, 8, 0.4);
        color: #fef08a;
        border-radius: 8px;
        padding: 16px 20px;
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .callback-banner {
        margin-top: 12px;
        background: rgba(239, 68, 68, 0.12);
        border: 2px solid rgba(239, 68, 68, 0.55);
        color: #fecaca;
        border-radius: 8px;
        padding: 16px 20px;
        font-size: 0.9rem;
        line-height: 1.6;
        text-align: left;
      }
      .callback-title {
        display: block;
        font-size: 1rem;
        letter-spacing: 0.04em;
        color: #fca5a5;
        margin-bottom: 6px;
      }
      .callback-text {
        margin: 0;
      }
      .wire-revealed-card {
        background: #0b1120;
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
      }
      .revealed-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }
      .unlocked-icon {
        background: rgba(34, 197, 94, 0.15);
        padding: 10px;
        border-radius: 8px;
        display: flex;
      }
      .revealed-title {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #f8fafc;
      }
      .revealed-subtitle {
        margin: 4px 0 0 0;
        font-size: 0.85rem;
        color: #86efac;
      }
      .wire-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      }
      @media (max-width: 650px) {
        .wire-grid {
          grid-template-columns: 1fr;
        }
      }
      .wire-item {
        background: rgba(15, 23, 42, 0.8);
        padding: 14px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .wire-label {
        display: block;
        font-size: 0.75rem;
        color: #94a3b8;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .wire-value {
        font-size: 1.05rem;
        color: #f8fafc;
        font-weight: 600;
      }
      .beneficiary-val {
        color: #38bdf8;
      }
      .code-val {
        font-family: monospace;
        letter-spacing: 0.05em;
        font-size: 1.15rem;
      }
      .revealed-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: gap;
        gap: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .compliance-note {
        font-size: 0.8rem;
        color: #64748b;
      }
      .btn-lock-again {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #cbd5e1;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .btn-lock-again:hover {
        background: rgba(255, 255, 255, 0.06);
      }
    `,
  ],
})
export class EscrowVerifyPageComponent implements OnInit {
  token = '';
  manualOtp = '';
  smsPhone = '';
  smsStatus = '';
  isModalOpen = false;
  isValidating = false;
  isRequestingSms = false;
  errorMessage = '';
  wireDetails: WireInstructionResponseDto | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: PracticeVaultApiService
  ) {}

  ngOnInit(): void {
    const routeToken = this.route.snapshot.paramMap.get('token')?.trim();
    if (routeToken) {
      this.token = routeToken;
      return;
    }
    this.errorMessage = 'Escrow verification token is required.';
  }

  submitOtp(otpCode: string): void {
    if (!this.token) {
      this.errorMessage = 'Escrow verification token is required.';
      return;
    }
    this.errorMessage = '';
    this.isValidating = true;

    this.api
      .verifyEscrowOtp(this.token, {
        token: this.token,
        otpCode: otpCode.trim(),
      })
      .subscribe({
        next: (res) => {
          this.isValidating = false;
          this.isModalOpen = false;
          this.wireDetails = res;
        },
        error: (err) => {
          this.isValidating = false;
          this.errorMessage =
            err?.error?.message ||
            'Invalid rolling OTP code. Verification rejected under ALTA Pillar 3.';
        },
      });
  }

  lockWire(): void {
    this.wireDetails = null;
    this.manualOtp = '';
    this.smsStatus = '';
    this.errorMessage = '';
  }

  requestSmsCode(): void {
    if (!this.token) {
      this.errorMessage = 'Escrow verification token is required.';
      return;
    }
    if (!this.smsPhone.trim()) {
      this.errorMessage = 'A destination phone number is required.';
      return;
    }
    this.errorMessage = '';
    this.smsStatus = '';
    this.isRequestingSms = true;

    this.api.requestEscrowSmsOtp(this.token, this.smsPhone.trim()).subscribe({
      next: () => {
        this.isRequestingSms = false;
        this.smsStatus =
          'A one-time code was dispatched. Enter it above within 90 seconds.';
      },
      error: (err) => {
        this.isRequestingSms = false;
        this.errorMessage =
          err?.error?.message ||
          'The SMS code could not be dispatched. No code was sent.';
      },
    });
  }
}
