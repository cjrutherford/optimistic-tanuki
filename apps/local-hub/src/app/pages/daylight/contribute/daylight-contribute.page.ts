import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type LocalHubMembership,
  problem,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { catchError, map, of } from 'rxjs';
import { DaylightContributorTermsComponent } from '../../../components/daylight-terms/daylight-contributor-terms.component';

type Standing =
  | { status: 'loading' }
  | { status: 'ready'; membership: LocalHubMembership }
  | { status: 'failed'; message: string };

/** Only a path on this site; anything else could send someone elsewhere. */
export function safeReturnUrl(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null;
}

/**
 * Signing up to contribute to Daylight (D27). Joining Towne Square grants
 * no contribution rights; agreeing to these terms does, once the account's
 * email address is verified.
 */
@Component({
  selector: 'app-daylight-contribute-page',
  imports: [
    FormsModule,
    RouterLink,
    ButtonComponent,
    DaylightContributorTermsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-contribute.page.html',
  styleUrl: './daylight-contribute.page.scss',
})
export class DaylightContributePage {
  private readonly civic = inject(CivicAPIService);

  protected readonly returnUrl = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((params) => safeReturnUrl(params.get('returnUrl')))
    ),
    { initialValue: null }
  );

  private readonly standing = signal<Standing>({ status: 'loading' });
  protected readonly membership = computed(() => {
    const standing = this.standing();
    return standing.status === 'ready' ? standing.membership : null;
  });
  protected readonly failure = computed(() => {
    const standing = this.standing();
    return standing.status === 'failed' ? standing.message : '';
  });
  protected readonly isContributor = computed(
    () =>
      this.membership()?.permissions.includes('contribution.create') ?? false
  );

  protected agreed = false;
  /** The name reports are published under: the local-hub display name, fixed once signed up (P5.1). */
  protected handle = '';
  protected readonly pending = signal(false);
  protected readonly problem = signal('');
  protected readonly joined = signal(false);

  constructor() {
    this.civic
      .me()
      .pipe(
        map((reply): Standing => ({ status: 'ready', membership: reply.data })),
        catchError((error: unknown) =>
          of<Standing>({
            status: 'failed',
            message: problem(
              error,
              'Your account could not be checked. Try again in a moment.'
            ),
          })
        )
      )
      .subscribe((standing) => {
        this.standing.set(standing);
        if (standing.status === 'ready')
          this.handle = standing.membership.handle;
      });
  }

  /** Two to forty characters on one line, as the gateway requires. */
  protected handleIsValid(): boolean {
    const handle = this.handle.trim();
    return handle.length >= 2 && handle.length <= 40 && !/[\r\n]/u.test(handle);
  }

  protected signUp(): void {
    if (!this.agreed || !this.handleIsValid()) return;
    this.pending.set(true);
    this.problem.set('');
    this.civic
      .signUpAsContributor({ agreeToTerms: true, handle: this.handle.trim() })
      .subscribe({
        next: (reply) => {
          this.pending.set(false);
          this.standing.set({ status: 'ready', membership: reply.data });
          this.joined.set(true);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.problem.set(
            problem(error, 'The sign-up did not go through. Try again.')
          );
        },
      });
  }
}
