import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectDaylightTown } from '../daylight-town';

/**
 * What a civic watcher does, for the person being recruited. It says the
 * uncomfortable parts too (most contributions never reach a briefing, and
 * review is automatic with no human appeal), because someone who learns
 * that afterwards is someone we have wasted. Ported from the Daylight POC
 * (plan slice P4.4).
 */
@Component({
  selector: 'app-daylight-watch-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-watch.page.html',
  styleUrl: './daylight-watch.page.scss',
})
export class DaylightWatchPage {
  protected readonly town = injectDaylightTown();
  /** The town's name once it is known; until then the slug reads badly, so say "your town". */
  protected readonly name = computed(
    () => this.town.city()?.name || 'your town'
  );
}
