import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type ContributionView,
  problem,
  type SubjectOption,
  type SubmissionRequest,
  submissionKey,
  type SurfaceItem,
} from '@optimistic-tanuki/civic-briefing-data-access';
import {
  longDate,
  ReviewTrailComponent,
} from '@optimistic-tanuki/civic-briefing-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { injectDaylightTown } from '../daylight-town';

/** The largest attachment, as the gateway enforces it; checked here first so a large file is refused before it uploads. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Report something from a town to Daylight: an account of what you
 * witnessed, or a document, photograph or recording. The page shows the
 * review's decision and every reason the moment it is made. Ported from the
 * Daylight POC (plan slice P4.4).
 */
@Component({
  selector: 'app-daylight-report-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    TextAreaComponent,
    ReviewTrailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-report.page.html',
  styleUrl: './daylight-report.page.scss',
})
export class DaylightReportPage {
  private readonly civic = inject(CivicAPIService);
  private readonly fb = inject(FormBuilder);
  protected readonly longDate = longDate;
  protected readonly town = injectDaylightTown();

  /** A report this contribution corroborates, from ?corroborate=<id>. */
  private readonly corroborate = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((params) => params.get('corroborate'))
    ),
    { initialValue: null }
  );

  /** The report being corroborated, as the community surface shows it. */
  protected readonly target = toSignal(
    combineLatest([
      toObservable(this.town.localitySlug),
      toObservable(this.corroborate),
    ]).pipe(
      switchMap(([locality, id]) =>
        locality && id
          ? this.civic.surface(locality).pipe(
              map(
                (reply) =>
                  reply.data.items.find((item) => item.id === id) ?? null
              ),
              catchError(() => of(null))
            )
          : of(null)
      )
    ),
    { initialValue: null as SurfaceItem | null }
  );

  /** One key per attempt at this form: pressing send again after a dropped connection cannot record it twice. */
  private key = submissionKey();

  /** Whether this account may report; a reader is told how to become a contributor rather than refused later. */
  protected readonly canReport = toSignal(
    this.civic.me().pipe(
      map((reply): boolean | null =>
        reply.data.permissions.includes('contribution.create')
      ),
      catchError(() => of(false))
    ),
    { initialValue: null }
  );

  protected readonly subjects = toSignal(
    toObservable(this.town.localitySlug).pipe(
      switchMap((locality) =>
        locality
          ? this.civic.subjects(locality).pipe(
              map((reply) => reply.data),
              catchError(() => of([] as SubjectOption[]))
            )
          : of([] as SubjectOption[])
      )
    ),
    { initialValue: [] as SubjectOption[] }
  );
  protected readonly meetings = computed(() =>
    this.subjects().filter((option) => option.kind === 'meeting')
  );
  protected readonly stories = computed(() =>
    this.subjects().filter((option) => option.kind === 'story')
  );

  protected readonly form = this.fb.nonNullable.group({
    kind: 'account' as 'account' | 'artifact',
    about: '',
    subjectText: '',
    occurredOn: '',
    body: '',
    links: '',
    disclosedInterest: '',
    witnessed: false,
    ownWords: false,
    rightsToAttachments: false,
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: 'account' as const,
  });
  protected readonly about = toSignal(this.form.controls.about.valueChanges, {
    initialValue: '',
  });
  protected readonly attachment = signal<File | null>(null);
  protected readonly pending = signal(false);
  protected readonly problems = signal<string[]>([]);
  protected readonly result = signal<ContributionView | null>(null);
  protected readonly today = new Date().toISOString().slice(0, 10);

  constructor() {
    // A report about a published meeting takes its date unless one is given.
    effect(() => {
      const about = this.about();
      const option = this.subjects().find(
        (candidate) => `${candidate.kind}:${candidate.ref}` === about
      );
      if (option?.date && !this.form.controls.occurredOn.value)
        this.form.controls.occurredOn.setValue(option.date);
    });
  }

  protected chooseFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.problems.set(
      file && file.size > MAX_UPLOAD_BYTES
        ? [
            `That file is ${(file.size / 1_048_576).toFixed(
              1
            )} MB; the most accepted is 20 MB.`,
          ]
        : []
    );
    this.attachment.set(file && file.size <= MAX_UPLOAD_BYTES ? file : null);
  }

  protected submit(): void {
    const locality = this.town.localitySlug();
    if (!locality) return;
    const value = this.form.getRawValue();
    const [aboutKind, aboutRef] = value.about.split(':');
    const target = this.target();
    const subject: SubmissionRequest['subject'] = target
      ? { kind: 'contribution', ref: target.id, text: '' }
      : aboutKind === 'meeting' || aboutKind === 'story'
      ? { kind: aboutKind, ref: aboutRef ?? null, text: '' }
      : { kind: 'other', ref: null, text: value.subjectText.trim() };
    const links = value.links
      .split(/\s+/u)
      .map((link) => link.trim())
      .filter(Boolean);
    const attachment = this.attachment();
    this.pending.set(true);
    this.problems.set([]);
    this.civic
      .submit(
        {
          submission: {
            localitySlug: locality,
            kind: value.kind,
            subject,
            occurredOn: value.occurredOn || (target ? target.occurredOn : null),
            body: value.body,
            links,
            disclosedInterest: value.disclosedInterest.trim() || null,
            representations: {
              ...(value.kind === 'account'
                ? { witnessed: value.witnessed }
                : {}),
              ownWords: value.ownWords,
              ...(attachment
                ? { rightsToAttachments: value.rightsToAttachments }
                : {}),
            },
          },
          ...(attachment ? { attachment } : {}),
        },
        { headers: { 'Idempotency-Key': this.key } }
      )
      .subscribe({
        next: (reply) => {
          this.pending.set(false);
          this.result.set(reply.data);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          const reasons = (error as { error?: { reasons?: unknown } })?.error
            ?.reasons;
          this.problems.set(
            Array.isArray(reasons)
              ? reasons.map(String)
              : [
                  problem(
                    error,
                    'The report could not be sent. Try again in a moment.'
                  ),
                ]
          );
        },
      });
  }

  protected another(): void {
    this.key = submissionKey();
    this.result.set(null);
    this.attachment.set(null);
    this.form.reset();
  }
}
