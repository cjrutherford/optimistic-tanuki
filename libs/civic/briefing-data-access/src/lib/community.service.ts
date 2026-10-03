import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  CommunitySurface,
  ContributionState,
  ContributionView,
  ContributorPage,
  CounterNoticeBody,
  OfficialApplicationResult,
  SubjectKind,
  SubjectOption,
  TakedownNoticeBody,
} from '@optimistic-tanuki/models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { map, type Observable } from 'rxjs';

/** What the report form sends; the gateway adds who is sending it. */
export interface Submission {
  localitySlug: string;
  kind: 'account' | 'artifact';
  subject: { kind: SubjectKind; ref: string | null; text: string };
  occurredOn: string | null;
  body: string;
  links: string[];
  disclosedInterest: string | null;
  representations: {
    witnessed?: boolean;
    ownWords?: boolean;
    rightsToAttachments?: boolean;
  };
}

/** The community routes: contributing, reading the surface, and copyright. */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/local-hub`;

  subjects(slug: string): Observable<SubjectOption[]> {
    return this.http
      .get<{ data: SubjectOption[] }>(
        `${this.base}/editions/${encodeURIComponent(slug)}/subjects`
      )
      .pipe(map((response) => response.data));
  }

  /** The key makes a retry safe: the service returns the first submission instead of recording a second. */
  submit(
    submission: Submission,
    attachment: File | null,
    idempotencyKey: string
  ): Observable<ContributionView> {
    const form = new FormData();
    form.append('submission', JSON.stringify(submission));
    if (attachment) form.append('attachment', attachment, attachment.name);
    return this.http
      .post<{ data: ContributionView }>(`${this.base}/contributions`, form, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map((response) => response.data));
  }

  surface(slug: string): Observable<CommunitySurface> {
    return this.http
      .get<{ data: CommunitySurface }>(
        `${this.base}/editions/${encodeURIComponent(slug)}/community`
      )
      .pipe(map((response) => response.data));
  }

  contributor(id: string): Observable<ContributorPage> {
    return this.http
      .get<{ data: ContributorPage }>(
        `${this.base}/contributors/${encodeURIComponent(id)}`
      )
      .pipe(map((response) => response.data));
  }

  /** Always served as a download: nothing contributed is rendered in this origin. */
  artifactUrl(sha256: string): string {
    return `${this.base}/artifacts/${encodeURIComponent(sha256)}`;
  }

  mine(): Observable<ContributionView[]> {
    return this.http
      .get<{ data: ContributionView[] }>(`${this.base}/contributions/mine`)
      .pipe(map((response) => response.data));
  }

  withdraw(id: string): Observable<ContributionView> {
    return this.http
      .post<{ data: ContributionView }>(
        `${this.base}/contributions/${encodeURIComponent(id)}/withdraw`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  counterNotice(
    id: string,
    body: CounterNoticeBody
  ): Observable<{ id: string }> {
    return this.http
      .post<{ data: { id: string } }>(
        `${this.base}/contributions/${encodeURIComponent(id)}/counter-notice`,
        body
      )
      .pipe(map((response) => response.data));
  }

  applyOfficial(localitySlug: string): Observable<OfficialApplicationResult> {
    return this.http
      .post<{ data: OfficialApplicationResult }>(
        `${this.base}/officials/apply`,
        { localitySlug }
      )
      .pipe(map((response) => response.data));
  }

  fileNotice(
    notice: TakedownNoticeBody
  ): Observable<{ id: string; locatedContributions: number }> {
    return this.http
      .post<{ data: { id: string; locatedContributions: number } }>(
        `${this.base}/copyright/notices`,
        notice
      )
      .pipe(map((response) => response.data));
  }
}

/** A key for one submission attempt; resending the same form reuses it. */
export function submissionKey(): string {
  return globalThis.crypto.randomUUID();
}

/** A contribution's state in the contributor's terms. */
export const STATE_WORDS: Record<
  ContributionState,
  { label: string; meaning: string }
> = {
  accepted: {
    label: 'Recorded',
    meaning:
      'Nothing in it needs to wait. It is kept, ready to be corroborated later in the beta.',
  },
  held: {
    label: 'Waiting for evidence',
    meaning:
      'It is kept, and waits until a document or an independent account supports it.',
  },
  rejected: {
    label: 'Not accepted',
    meaning: 'It was not taken in; the reason says what to change.',
  },
  withdrawn: { label: 'Withdrawn', meaning: 'You withdrew it.' },
  'taken-down': {
    label: 'Taken down',
    meaning:
      'It was removed on a copyright notice. You may answer with a counter-notice.',
  },
};

export const STAGE_WORDS: Record<string, string> = {
  upload: 'Attachment',
  duplication: 'Copying check',
  model: 'Review',
  withdrawal: 'Withdrawal',
  takedown: 'Copyright notice',
  restoration: 'Restored',
  corroboration: 'Corroboration',
  briefing: 'In a briefing',
};
