import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, of } from 'rxjs';

/** The longest town name the page will repeat back from `?town=`. */
const TOWN_MAX_LENGTH = 80;

@Component({
  selector: 'otui-public-contact-page',
  imports: [],
  templateUrl: './public-contact-page.component.html',
  styleUrl: './public-contact-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicContactPageComponent {
  private readonly route = inject(ActivatedRoute, { optional: true });

  /** A town named by `?town=`, which pre-fills the partnership email's subject. */
  protected readonly town = toSignal(this.townParam(), {
    initialValue: '',
  });

  private townParam(): Observable<string> {
    if (!this.route) return of('');
    return this.route.queryParamMap.pipe(
      map(
        (params) => params.get('town')?.trim().slice(0, TOWN_MAX_LENGTH) ?? ''
      )
    );
  }

  protected partnerMailto(town: string): string {
    const subject = `Daylight sources for ${town}`;
    return `mailto:support@hopefulaspirationsindustries.com?subject=${encodeURIComponent(
      subject
    )}`;
  }
}
