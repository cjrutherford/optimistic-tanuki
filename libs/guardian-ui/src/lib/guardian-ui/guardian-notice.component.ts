import { Component, Input } from '@angular/core';

export const GUARDIAN_NOTICE_VERSION = 'RR11-PARENT-2026-10-14-v1';
export const GUARDIAN_NOTICE_TITLE =
  'Give permission for your teen to use Optimistic Tanuki and Towne Square';
export const GUARDIAN_NOTICE_TEXT =
  'To give permission, create your own guardian account and confirm that you are the teen’s parent or guardian. We will link your account to the teen’s pending request; the teen’s account stays inactive until you give permission and they complete registration. Your attestation gives you access to view and manage the teen’s posts, settings, and content, including creating, editing, and deleting content. Actions you take are attributed to you as the guardian. Do not share passwords; you do not sign in as the teen. You may withdraw permission from your guardian account; withdrawal disables the teen’s account in both apps and ends your access. Your access is also removed automatically when the teen turns 18. We will notify you when our permission policy changes; you do not need to attest again for a policy change. We do not require identity documents or independently verify your identity or guardianship. We keep only a minimal permission record, including your contact information and the teen’s date of birth, while permission is needed. We delete it within 90 days after permission is withdrawn, the account is closed, or the teen turns 18. Unapproved requests expire within 90 days.';
export const TEEN_ELIGIBILITY_NOTICE =
  'Optimistic Tanuki and Towne Square are mainly for adults 18 and older. If you are 13–17, a parent or legal guardian must give permission before you can finish registration. Under 13 is not supported. Your account stays inactive until permission is recorded and you complete registration.';

@Component({
  selector: 'lib-guardian-notice',
  standalone: true,
  template: `
    <section
      class="guardian-notice"
      [attr.aria-labelledby]="audience + '-notice-title'"
    >
      @if (audience === 'guardian') {
      <p class="guardian-notice__version">Approved notice · {{ version }}</p>
      }
      <h2 [id]="audience + '-notice-title'">
        {{
          audience === 'guardian'
            ? guardianTitle
            : 'Age eligibility and permission'
        }}
      </h2>
      <p>{{ audience === 'guardian' ? guardianText : teenText }}</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .guardian-notice {
        padding: clamp(1rem, 2vw, 1.5rem);
        margin: 1rem 0;
        border: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
        border-radius: 1rem;
        background: var(--surface-variant);
      }
      .guardian-notice p:last-child {
        margin-bottom: 0;
        line-height: 1.65;
      }
      .guardian-notice__version {
        margin: 0 0 0.4rem;
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    `,
  ],
})
export class GuardianNoticeComponent {
  @Input() audience: 'guardian' | 'teen' = 'guardian';
  readonly version = GUARDIAN_NOTICE_VERSION;
  readonly guardianTitle = GUARDIAN_NOTICE_TITLE;
  readonly guardianText = GUARDIAN_NOTICE_TEXT;
  readonly teenText = TEEN_ELIGIBILITY_NOTICE;
}
