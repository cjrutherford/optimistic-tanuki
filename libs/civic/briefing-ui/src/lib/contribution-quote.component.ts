import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  artifactUrl,
  type PublicContribution,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { longDate } from './dates';

/**
 * One contribution, as its contributor wrote it. The words are quoted, never
 * rewritten, and attributed to the handle; a disclosure is shown with them;
 * an attachment is a download, never displayed in the page.
 */
@Component({
  selector: 'civic-contribution-quote',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <blockquote>
      <p class="words">{{ contribution().body }}</p>
      <footer>
        <a [routerLink]="['/contributors', contribution().contributor.id]">{{
          contribution().contributor.handle
        }}</a
        >, {{ contribution().kind === 'artifact' ? 'sent' : 'reported' }}
        {{ longDate(contribution().submittedAt.slice(0, 10)) }}
        @if (contribution().disclosedInterest) {
        <span class="interest"
          >Disclosed: {{ contribution().disclosedInterest }}</span
        >
        }
      </footer>
      @if (contribution().artifact; as artifact) {
      <p class="attachment">
        <a [href]="artifactUrl(artifact.sha256)" download rel="nofollow"
          >Download the {{ describe(artifact.mediaType) }}</a
        >
        ({{ size(artifact.bytes) }})
      </p>
      } @if (contribution().links.length) {
      <ul class="links">
        @for (link of contribution().links; track link) {
        <li>
          <a [href]="link" target="_blank" rel="noopener noreferrer nofollow">{{
            host(link)
          }}</a>
        </li>
        }
      </ul>
      }
    </blockquote>
  `,
  styleUrl: './contribution-quote.component.scss',
})
export class ContributionQuoteComponent {
  readonly contribution = input.required<PublicContribution>();
  protected readonly longDate = longDate;
  protected readonly artifactUrl = artifactUrl;

  protected describe(mediaType: string): string {
    if (mediaType === 'application/pdf') return 'document (PDF)';
    if (mediaType.startsWith('image/')) return 'photograph';
    if (mediaType.startsWith('audio/')) return 'recording';
    return 'attachment';
  }

  protected size(bytes: number): string {
    return bytes > 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  protected host(link: string): string {
    try {
      return new URL(link).host;
    } catch {
      return link;
    }
  }
}
