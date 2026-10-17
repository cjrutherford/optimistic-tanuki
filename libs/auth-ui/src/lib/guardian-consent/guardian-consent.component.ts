import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { GuardianNoticeComponent } from '@optimistic-tanuki/guardian-ui';

export function guardianConsentRoutes(): Routes {
  return [
    { path: 'auth/guardian-consent', component: GuardianConsentComponent },
  ];
}

@Component({
  selector: 'lib-guardian-consent',
  standalone: true,
  imports: [CommonModule, FormsModule, GuardianNoticeComponent],
  template: `
    <main aria-labelledby="guardian-consent-title">
      <section>
        <h1 id="guardian-consent-title">Parent or guardian permission</h1>
        <lib-guardian-notice audience="guardian"></lib-guardian-notice>
        @if (state === 'ready' && !withdrawalToken) {
        <p>
          Sign in to the adult account at the contact address where this request
          was sent. Open sign in in a new tab, then return here to continue;
          this private link stays in this tab.
        </p>
        <a href="/login" target="_blank" rel="noopener noreferrer"
          >Sign in as the invited guardian</a
        >
        <a href="/register" target="_blank" rel="noopener noreferrer"
          >Create an adult account</a
        >
        <p>
          If your account has not confirmed that you are an adult, enter your
          date of birth for this private check. The server uses it only to
          assess adult eligibility and does not retain it. Leave it blank if
          your account is already assessed as an adult.
        </p>
        <p>
          By checking the box, you state that you are the user's parent or legal
          guardian and give permission for their use of Optimistic Tanuki and
          Towne Square while they are under 18.
        </p>
        <p role="status" aria-live="polite">{{ message }}</p>
        <form (ngSubmit)="submit()">
          <label for="guardian-date-of-birth"
            >Date of birth, if adult eligibility has not been assessed</label
          >
          <input
            id="guardian-date-of-birth"
            name="guardianDateOfBirth"
            type="date"
            autocomplete="bday"
            [(ngModel)]="dateOfBirth"
          />
          <label class="attestation"
            ><input
              name="attested"
              type="checkbox"
              required
              [(ngModel)]="attested"
            />
            I am the parent or legal guardian and give this permission.</label
          >
          <button type="submit" [disabled]="!attested">
            Record permission
          </button>
        </form>
        <p>
          This records your statement. It does not independently verify identity
          or guardianship. If you did not request this, close this page.
        </p>
        } @else if (state === 'ready' && withdrawalToken) {
        <p>
          Withdrawing permission disables this minor account across Optimistic
          Tanuki and Towne Square.
        </p>
        <p role="status" aria-live="polite">{{ message }}</p>
        <label class="attestation"
          ><input
            name="withdrawConfirmed"
            type="checkbox"
            [(ngModel)]="withdrawConfirmed"
          />
          I want to withdraw permission.</label
        >
        <button
          type="button"
          [disabled]="!withdrawConfirmed"
          (click)="withdraw()"
        >
          Withdraw permission
        </button>
        <p>
          If the applicant did not receive the continuation email, you can retry
          while registration remains active.
        </p>
        <button
          type="button"
          [disabled]="resending"
          (click)="resendApplicantLink()"
        >
          {{ resending ? 'Sending…' : 'Retry applicant email' }}
        </button>
        } @else if (state === 'success' && withdrawalUrl) {
        <p role="status" aria-live="polite">{{ message }}</p>
        <p>
          Save this private permission control link. It lets you withdraw
          permission without signing in.
        </p>
        <button type="button" (click)="copyWithdrawalLink()">
          Copy private permission control link
        </button>
        @if (linkCopied) {
        <p role="status">Private link copied.</p>
        } @if (continuationRequired && !applicantNotified) {
        <p>
          The applicant continuation email was not confirmed as sent. You can
          retry while the original private continuation link is active.
        </p>
        <button
          type="button"
          [disabled]="resending"
          (click)="resendApplicantLink()"
        >
          {{ resending ? 'Sending…' : 'Retry applicant email' }}
        </button>
        } } @else {
        <p role="status" aria-live="polite">{{ message }}</p>
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        padding: clamp(1rem, 5vw, 4rem);
        background: var(--background);
        color: var(--foreground);
      }
      section {
        max-width: 38rem;
        margin: 4vh auto;
        padding: clamp(1.25rem, 4vw, 2.5rem);
        border-radius: 1rem;
        background: var(--surface);
        box-shadow: var(--shadow-lg);
      }
      form {
        display: grid;
        gap: 1rem;
        margin: 1.5rem 0;
      }
      input[type='email'] {
        width: 100%;
        box-sizing: border-box;
        padding: 0.75rem;
      }
      .attestation {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
      }
      button {
        min-height: 2.75rem;
        padding: 0.65rem 1rem;
      }
    `,
  ],
})
export class GuardianConsentComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  token = '';
  withdrawalToken = '';
  withdrawalUrl = '';
  applicantNotified = false;
  continuationRequired = false;
  dateOfBirth = '';
  resending = false;
  linkCopied = false;
  withdrawConfirmed = false;
  attested = false;
  state: 'ready' | 'success' | 'error' = 'ready';
  message = '';

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.token =
      new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || '';
    this.withdrawalToken =
      new URLSearchParams(location.hash.replace(/^#/, '')).get(
        'withdrawToken'
      ) || '';
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${location.search}`
    );
    if (!this.token && !this.withdrawalToken) {
      this.state = 'error';
      this.message =
        'This private permission link is missing or invalid. Request a new link from the registration page.';
    }
  }

  async submit(): Promise<void> {
    if (!this.token || !this.attested) return;
    const dateOfBirth = this.dateOfBirth;
    this.dateOfBirth = '';
    try {
      const result = await this.http
        .post<{
          attested: true;
          applicantNotified: boolean;
          continuationRequired: boolean;
          withdrawalUrl: string;
        }>('/api/authentication/guardian-consent/attest', {
          token: this.token,
          attested: true,
          attestationVersion: 'guardian-attestation-v1',
          ...(dateOfBirth ? { dateOfBirth } : {}),
        })
        .toPromise();
      this.token = '';
      this.withdrawalUrl = result?.withdrawalUrl || '';
      this.withdrawalToken =
        new URLSearchParams(
          new URL(this.withdrawalUrl || location.href).hash.replace(/^#/, '')
        ).get('withdrawToken') || '';
      this.applicantNotified = result?.applicantNotified === true;
      this.continuationRequired = result?.continuationRequired === true;
      this.state = 'success';
      this.message = !this.continuationRequired
        ? 'Permission was recorded for the existing account. The user can sign in now.'
        : this.applicantNotified
        ? 'Permission was recorded. A private continuation link was sent to the applicant.'
        : 'Permission was recorded, but the applicant continuation email could not be sent.';
    } catch {
      this.message =
        'Permission could not be recorded. Sign in to the invited adult account and try again; the private link may also have expired or already been used.';
    }
  }

  async resendApplicantLink(): Promise<void> {
    if (!this.withdrawalToken || this.resending) return;
    this.resending = true;
    try {
      const result = await this.http
        .post<{ sent: boolean }>(
          '/api/authentication/guardian-consent/resend-continuation',
          { token: this.withdrawalToken }
        )
        .toPromise();
      this.applicantNotified = result?.sent === true;
      this.message = this.applicantNotified
        ? 'Permission was recorded. A private continuation link was sent to the applicant.'
        : 'The applicant continuation email could not be sent. You may retry while the original private continuation link is active.';
    } catch {
      this.message =
        'The continuation email could not be retried. The permission link may have expired or already been used.';
    } finally {
      this.resending = false;
    }
  }

  async copyWithdrawalLink(): Promise<void> {
    if (!this.withdrawalUrl || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.withdrawalUrl);
      this.linkCopied = true;
    } catch {
      this.message =
        'The private link could not be copied. Keep this page open and try again.';
    }
  }

  async withdraw(): Promise<void> {
    if (!this.withdrawalToken || !this.withdrawConfirmed) return;
    try {
      const result = await this.http
        .post<{ revoked: true; noLongerNeeded?: true }>(
          '/api/authentication/guardian-consent/withdraw',
          { token: this.withdrawalToken }
        )
        .toPromise();
      this.withdrawalToken = '';
      this.state = 'success';
      this.message = result?.noLongerNeeded
        ? 'This permission control has ended because the user reached 18. It did not change adult account access.'
        : 'Permission was withdrawn. The minor account can no longer access Optimistic Tanuki or Towne Square.';
    } catch {
      this.state = 'error';
      this.message =
        'Permission could not be withdrawn. The private link may have expired or already been used.';
    }
  }
}
