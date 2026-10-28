import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '@optimistic-tanuki/common-ui';

/** Public guidance uses only explicitly configured OT/TS routes, with no account payload. */
@Component({
  selector: 'lib-release-information',
  standalone: true,
  imports: [RouterLink, CardComponent],
  template: `
    <article class="release-information" aria-labelledby="release-title">
      <p class="eyebrow">{{ name }} · Early access</p>
      <h1 id="release-title">
        {{ policy ? 'Privacy and account data' : 'Getting started' }}
      </h1>
      <p>
        Choose what you want to do. You do not need to join a community to have
        an account.
      </p>
      @if (!policy) {
      <otui-card>
        <h2>Your first visit</h2>
        <ol>
          <li>
            <a routerLink="/login">Sign in</a> or
            <a routerLink="/register">create an account</a>. Check the current
            profile before sharing.
          </li>
          <li>
            <a [routerLink]="accountPath">Review your profile and account</a>.
            Signed-out visitors will be asked to sign in.
          </li>
          @if (appId === 'client-interface') {
          <li>
            <a routerLink="/feed">Open your feed</a> or
            <a routerLink="/communities">browse communities</a>. Choose the
            audience before publishing.
          </li>
          } @else {
          <li>
            <a routerLink="/cities">Browse places</a>, then open a locality or
            community. Private membership may need an owner's approval.
          </li>
          <li>
            Within a community, open Classifieds to view listings or make an
            offer. An accepted offer creates a pending payment record; it does
            not confirm a card charge. Confirm any exchange directly with the
            other person.
          </li>
          }
          <li>
            <a routerLink="/messages">Open Messages</a> to follow up. Reconnect
            if your connection drops; do not assume a reply was delivered just
            because you sent it.
          </li>
        </ol>
        <h2>If something fails</h2>
        <p>
          Read the status before retrying. Keep your draft if the network is
          unavailable. If you are unsure whether a payment or account request
          succeeded, refresh its status before sending another request.
        </p>
        <p>
          For an export or deletion request, open Your account data on the
          account page. Keep the deletion recovery receipt before signing out so
          you can
          <a routerLink="/account-deletion">check a deletion request</a> later.
        </p>
      </otui-card>
      } @else {
      <otui-card>
        <h2>What these applications handle</h2>
        <p>
          Optimistic Tanuki and Towne Square share account services. They handle
          sign-in and linked-provider records, profiles, posts and replies,
          messages, uploaded media, memberships and account activity. Towne
          Square also uses listing and financial receipt records. Some financial
          records belong to the shared account rather than one product.
        </p>
        <h2>Choose an audience</h2>
        <p>
          Public content can be seen by a wider audience. Private communities
          restrict member content; a community's overview may still be
          discoverable. Check the audience before publishing. A recipient can
          make their own copy of a message or image. These applications do not
          promise end-to-end encryption.
        </p>
        <h2>Sessions and retention</h2>
        <p>
          Sessions expire after seven days of inactivity. Signing out ends the
          current session sooner. Inventoried account-activity records use a
          rolling 90-day retention window; an account-deletion request does not
          wait for that window.
        </p>
        <h2>Download or delete your account data</h2>
        <p>
          Open <a [routerLink]="accountPath">Your account data</a> to request an
          export or deletion. The export includes covered data from both
          applications and shared services, with other people's private details
          excluded. Download availability is shown in the request status.
        </p>
        <p>
          Accepted deletion signs you out of both applications. It removes your
          covered account data and contributions, preserves other people's
          content, and removes your identifying fields from shared audit
          history. If cleanup cannot be verified, the request stays blocked and
          can be retried using your recovery receipt. Deletion cannot be undone.
          Minimal deidentified deletion records remain to block stale activity
          under a deleted identity.
        </p>
        <p>
          Downloaded copies, offline devices, backups and provider-held
          information require separate handling. This control does not promise
          to remove those copies or delete an external provider account. Local
          verification does not establish production or backup erasure.
        </p>
        <h2>Browser and external services</h2>
        <p>
          The browser uses a session cookie and stores appearance preferences
          and a deletion recovery receipt when you make that request. Treat that
          receipt as private. Pages may request fonts or code from external
          content services. Sign-in providers, email delivery and payment
          services have their own systems; their operation is not guaranteed by
          the local account controls.
        </p>
        <h2>Questions or privacy requests</h2>
        <p>
          <a routerLink="/contact">Contact HAI support</a> for privacy requests,
          abuse reports or help. Do not include passwords, session tokens,
          private messages, payment credentials or your recovery receipt in a
          public report. No response time is promised.
        </p>
      </otui-card>
      }
      <nav aria-label="Release information">
        <a routerLink="/help">Getting started</a>
        <a routerLink="/privacy">Privacy and account data</a>
        <a routerLink="/contact">Contact and support</a>
        <a routerLink="/">Home</a>
      </nav>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--foreground);
        background: var(--background);
      }
      .release-information {
        max-width: 52rem;
        margin: 0 auto;
        padding: clamp(1rem, 4vw, 3rem);
        overflow-wrap: anywhere;
        line-height: 1.65;
      }
      h1 {
        font-size: clamp(1.75rem, 5vw, 2.5rem);
        line-height: 1.2;
      }
      h2 {
        font-size: 1.25rem;
        margin-block: 1.5rem 0.5rem;
      }
      .eyebrow {
        font-weight: 600;
      }
      a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      a:focus-visible {
        outline: 3px solid currentColor;
        outline-offset: 3px;
      }
      li {
        margin-block: 0.75rem;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-block: 1.5rem;
      }
    `,
  ],
})
export class ReleaseInformationComponent {
  private readonly data = inject(ActivatedRoute).snapshot.data;
  readonly appId = this.data['appId'];
  readonly policy = this.data['view'] === 'policy';
  readonly name =
    this.appId === 'client-interface' ? 'Optimistic Tanuki' : 'Towne Square';
  readonly accountPath =
    this.appId === 'client-interface' ? '/settings' : '/account';
  constructor() {
    if (!['client-interface', 'local-hub'].includes(this.appId))
      throw new Error('RELEASE_INFORMATION_SCOPE_REQUIRED');
  }
}
