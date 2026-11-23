import { DirectoryAdminService } from '../services/directory-admin.service';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

type Candidate = {
  communityId: string;
  changeToken: string;
  geographyHash: string;
  geoid: string;
  layer: 'place' | 'cousub';
  vintage: string;
  stateFips: string;
  archiveSha256: string;
  reviewContext: {
    name: string;
    city: string;
    adminArea: string;
    countryCode: string;
    localityType: 'city' | 'town';
  };
};
type View = {
  state: 'loading' | 'empty' | 'error' | 'candidate';
  candidate?: Candidate;
};

@Component({
  selector: 'app-boundary-review-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, CardComponent],
  template: `<section class="review-page" aria-labelledby="boundary-title">
    <a routerLink="/dashboard/towns" class="back-link">← All towns</a>
    <header>
      <p class="eyebrow">Town geography · private review</p>
      <h2 id="boundary-title">Boundary candidate</h2>
      <p>
        Compare the proposed Census boundary with an official government source
        before using it for a town.
      </p>
    </header>
    <otui-card
      ><div class="card-content" aria-live="polite">
        @if (view.state === 'loading') {
        <p>Checking the current candidate…</p>
        } @else if (view.state === 'error') {
        <h2>Candidate unavailable</h2>
        <p>
          The review service could not confirm a current eligible town. Try
          again later or check the service configuration.
        </p>
        } @else if (view.state === 'empty') {
        <h2>No current candidate</h2>
        <p>
          This town has no current candidate ready for review. Its
          boundary-dependent searches remain pending.
        </p>
        } @else if (view.candidate; as c) {
        <p class="status">Not verified</p>
        <h3>{{ c.reviewContext.name }}</h3>
        <p>
          {{ c.reviewContext.city }}, {{ c.reviewContext.adminArea }} ·
          {{ c.reviewContext.countryCode }}
        </p>
        <dl>
          <div>
            <dt>Community type</dt>
            <dd>{{ c.reviewContext.localityType }}</dd>
          </div>
          <div>
            <dt>Census layer</dt>
            <dd>
              {{ c.layer === 'place' ? 'Places' : 'County subdivisions' }}
            </dd>
          </div>
          <div>
            <dt>Census identifier</dt>
            <dd>{{ c.geoid }}</dd>
          </div>
          <div>
            <dt>Boundary vintage</dt>
            <dd>{{ c.vintage }}</dd>
          </div>
          <div class="fingerprint">
            <dt>Source archive SHA-256</dt>
            <dd>{{ c.archiveSha256 }}</dd>
          </div>
        </dl>
        <p class="notice">
          A point or name match alone is not sufficient. Compare the boundary in
          the pinned source archive and its Census identifier against an
          official government source. Leave ambiguous matches pending.
        </p>
        <div class="decision-form">
          <label for="official-source">Official government source URL</label>
          <input
            id="official-source"
            #source
            type="url"
            maxlength="2048"
            placeholder="https://www.census.gov/..."
            autocomplete="off"
          />
          <label class="confirmation"
            ><input #confirmed type="checkbox" /> I checked both the boundary
            and identifier against this official source and found no
            ambiguity.</label
          >
          <otui-button
            [disabled]="submitting"
            (click)="recordDecision(c, source.value, confirmed.checked)"
            >Record verification</otui-button
          >
          @if (message) {
          <p role="status">{{ message }}</p>
          }
          <p>
            Recording this review does not install a boundary or authorize
            public release.
          </p>
        </div>
        }
        <otui-button variant="secondary" (click)="refresh()"
          >Refresh candidate</otui-button
        >
      </div></otui-card
    >
  </section>`,
  styles: [
    `
      .review-page {
        max-width: 58rem;
        margin: 0 auto;
        padding: clamp(1rem, 3vw, 2.5rem);
        display: grid;
        gap: 1.5rem;
      }
      .back-link {
        color: var(--primary-text, var(--primary));
      }
      header p {
        max-width: 44rem;
        line-height: 1.6;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .card-content {
        padding: 1rem;
        display: grid;
        gap: 1rem;
      }
      .card-content h2,
      .card-content h3,
      .card-content p {
        margin: 0;
      }
      .status {
        width: fit-content;
        padding: 0.35rem 0.7rem;
        border: 1px solid currentColor;
        border-radius: 2rem;
        font-weight: 700;
      }
      dl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
        margin: 0.5rem 0;
      }
      dt {
        font-weight: 700;
        font-size: 0.8rem;
      }
      dd {
        margin: 0.35rem 0 0;
      }
      .fingerprint {
        grid-column: 1/-1;
        overflow-wrap: anywhere;
      }
      .decision-form {
        display: grid;
        gap: 0.75rem;
      }
      .decision-form input[type='url'] {
        width: 100%;
        padding: 0.65rem;
        border: 1px solid currentColor;
        border-radius: 0.3rem;
        background: transparent;
        color: inherit;
      }
      .confirmation {
        display: flex;
        gap: 0.6rem;
        align-items: start;
        line-height: 1.5;
      }
      .notice {
        border-inline-start: 3px solid currentColor;
        padding: 0.5rem 1rem;
        line-height: 1.5;
      }
    `,
  ],
})
export class BoundaryReviewPageComponent {
  private readonly admin = inject(DirectoryAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshes = new Subject<void>();
  view: View = { state: 'loading' };
  submitting = false;
  message = '';
  private pendingRequest?: { key: string; id: string };
  constructor() {
    combineLatest([
      this.route.paramMap,
      this.refreshes.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([params]) => {
          const id = params.get('townId') ?? params.get('communityId');
          this.view = { state: 'loading' };
          if (
            !id ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              id
            )
          )
            return of<View>({ state: 'error' });
          return this.admin
            .getBoundaryCandidate<{ candidate: Candidate | null }>(id)
            .pipe(
              map((result) =>
                result.candidate
                  ? { state: 'candidate' as const, candidate: result.candidate }
                  : { state: 'empty' as const }
              ),
              catchError(() => of<View>({ state: 'error' }))
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.view = result;
      });
  }
  recordDecision(c: Candidate, sourceUrl: string, confirmed: boolean) {
    if (!confirmed || !sourceUrl.trim() || this.submitting) {
      this.message =
        'Confirm your comparison and provide an official source URL.';
      return;
    }
    const candidate = {
      communityId: c.communityId,
      changeToken: c.changeToken,
      geographyHash: c.geographyHash,
      geoid: c.geoid,
      layer: c.layer,
      vintage: c.vintage,
      stateFips: c.stateFips,
      archiveSha256: c.archiveSha256,
    };
    const key = JSON.stringify([candidate, sourceUrl]);
    if (!this.pendingRequest || this.pendingRequest.key !== key) {
      if (typeof globalThis.crypto?.randomUUID !== 'function') {
        this.message =
          'A secure browser context is required to record a review.';
        return;
      }
      this.pendingRequest = { key, id: globalThis.crypto.randomUUID() };
    }
    this.submitting = true;
    this.message = 'Recording review…';
    this.admin
      .recordBoundaryDecision<{ recorded: boolean }>(c.communityId, {
        requestId: this.pendingRequest.id,
        decision: 'verified',
        attested: true,
        sourceUrl,
        candidate,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.message =
            'Review recorded. Boundary installation and public release remain pending.';
        },
        error: () => {
          this.submitting = false;
          this.message =
            'Review could not be recorded. Check the source and refresh the candidate before trying again.';
        },
      });
  }
  refresh() {
    this.message = '';
    this.pendingRequest = undefined;
    this.refreshes.next();
  }
}
