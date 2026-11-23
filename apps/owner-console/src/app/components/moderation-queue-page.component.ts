import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import type { ColDef } from '@optimistic-tanuki/ag-grid-ui';
import {
  OwnerConfirmService,
  OwnerDataTableComponent,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
} from '@optimistic-tanuki/owner-page-ui';
import {
  MODERATION_SOURCES,
  ModerationActionId,
  ModerationItem,
  ModerationQueueService,
  ModerationSource,
  SOURCE_LABELS,
  actionsFor,
  filterModerationItems,
  sortModerationItems,
} from '../services/moderation-queue.service';
import { TownContextService } from '../services/town-context.service';

/** Town filter value that follows the town switcher. */
export const FOLLOW_SWITCHER = 'follow';
export const ALL_TOWNS = 'all';

const DAY = 24 * 60 * 60 * 1000;

/** "3 days ago", "5 hours ago", "just now"; empty when there is no date. */
export function ageLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  const unit = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (elapsed >= DAY) return unit(Math.floor(elapsed / DAY), 'day');
  if (elapsed >= DAY / 24)
    return unit(Math.floor(elapsed / (DAY / 24)), 'hour');
  if (elapsed >= 60000) return unit(Math.floor(elapsed / 60000), 'minute');
  return 'just now';
}

/**
 * One list over social reports, forum reports, directory listing reports and
 * Daylight takedown notices. Each source loads on its own and shows its own
 * "Unavailable" notice, so a failure is never read as an empty queue.
 */
@Component({
  selector: 'app-moderation-queue-page',
  standalone: true,
  imports: [
    OwnerPageHeaderComponent,
    OwnerFilterBarComponent,
    OwnerDataTableComponent,
  ],
  templateUrl: './moderation-queue-page.component.html',
  styleUrls: ['./moderation-queue-page.component.scss'],
})
export class ModerationQueuePageComponent implements OnInit {
  private readonly queue = inject(ModerationQueueService);
  protected readonly towns = inject(TownContextService);
  private readonly router = inject(Router);
  private readonly confirm = inject(OwnerConfirmService);

  readonly sources = MODERATION_SOURCES;
  readonly sourceLabels = SOURCE_LABELS;
  readonly allTowns = ALL_TOWNS;
  readonly followSwitcher = FOLLOW_SWITCHER;

  readonly states = this.queue.states;
  readonly selectedSources = signal<readonly ModerationSource[]>([]);
  readonly townChoice = signal<string>(ALL_TOWNS);
  readonly status = signal<'open' | 'all'>('open');
  readonly text = signal('');
  readonly message = signal('');

  /** Town the lists are scoped to; null reads every town. */
  readonly townId = computed<string | null>(() => {
    const choice = this.townChoice();
    if (choice === ALL_TOWNS) return null;
    return choice === FOLLOW_SWITCHER ? this.towns.selectedId() : choice;
  });

  readonly rows = computed<ModerationItem[] | null>(() =>
    this.queue.settled()
      ? sortModerationItems(
          filterModerationItems(this.queue.items(), {
            sources: this.selectedSources(),
            townId: this.townId(),
            status: this.status(),
            text: this.text(),
          })
        )
      : null
  );

  readonly unavailable = computed(() =>
    MODERATION_SOURCES.filter(
      (source) => this.states()[source].status === 'unavailable'
    ).map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      error: this.states()[source].error ?? 'Could not be loaded',
    }))
  );
  readonly capped = computed(() =>
    MODERATION_SOURCES.filter((source) => this.states()[source].capped).map(
      (source) => SOURCE_LABELS[source]
    )
  );
  readonly everySourceDown = computed(() => this.unavailable().length === 4);
  readonly emptyMessage = computed(() =>
    this.unavailable().length
      ? 'No reports from the sources that loaded.'
      : this.status() === 'open'
      ? 'No open reports. Switch to All to see handled ones.'
      : 'No reports match.'
  );

  readonly columns: ColDef[] = [
    { headerName: 'Source', field: 'sourceLabel', minWidth: 150 },
    { headerName: 'Town', field: 'townName', minWidth: 130 },
    { headerName: 'Subject', field: 'subject', flex: 2, minWidth: 220 },
    { headerName: 'Reason', field: 'reason', flex: 1, minWidth: 160 },
    {
      headerName: 'Reported',
      field: 'reportedAt',
      minWidth: 140,
      valueFormatter: (params) => ageLabel(params.value as string | null),
      tooltipValueGetter: (params) => (params.value as string | null) ?? '',
    },
    { headerName: 'Status', field: 'statusLabel', minWidth: 120 },
    {
      headerName: 'Actions',
      minWidth: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: ModerationItem }) => {
        const container = document.createElement('div');
        container.className = 'moderation-actions';
        if (!params.data) return container;
        const item = params.data;
        for (const action of actionsFor(item)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = action.label;
          button.className = 'ag-grid-action-button';
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            void this.runAction(item, action.id);
          });
          container.appendChild(button);
        }
        return container;
      },
    },
  ];

  constructor() {
    // Reload when the scope changes (town, or open versus all) once towns
    // are known; the directory source needs the town list.
    effect(() => {
      const townsStatus = this.towns.status();
      const townId = this.townId();
      const includeClosed = this.status() === 'all';
      if (townsStatus === 'idle' || townsStatus === 'loading') return;
      untracked(() => this.queue.load({ townId, includeClosed }));
    });
  }

  ngOnInit(): void {
    this.towns.load();
  }

  setSources(source: ModerationSource, on: boolean): void {
    this.selectedSources.update((current) =>
      on
        ? [...current.filter((s) => s !== source), source]
        : current.filter((s) => s !== source)
    );
  }

  isSourceOn(source: ModerationSource): boolean {
    return this.selectedSources().includes(source);
  }

  setTown(value: string): void {
    this.townChoice.set(value);
  }

  setStatus(value: string): void {
    this.status.set(value === 'all' ? 'all' : 'open');
  }

  resetFilters(): void {
    this.selectedSources.set([]);
    this.townChoice.set(ALL_TOWNS);
    this.status.set('open');
  }

  retry(source: ModerationSource): void {
    this.queue.retry(source);
  }

  retryAll(): void {
    for (const source of MODERATION_SOURCES) this.queue.retry(source);
  }

  /** Open the page that shows this item. Notices have none. */
  open(item: ModerationItem): void {
    if (!item.link) return;
    void this.router.navigate(item.link.commands, {
      queryParams: item.link.queryParams,
    });
  }

  async runAction(
    item: ModerationItem,
    action: ModerationActionId
  ): Promise<void> {
    this.message.set('');
    const options =
      action === 'dismiss'
        ? {
            level: 'plain' as const,
            title: 'Dismiss this report',
            body: `Mark this ${item.sourceLabel.toLowerCase()} report as dismissed. You can reopen it from its own page.`,
            confirmLabel: 'Dismiss',
          }
        : action === 'decline'
        ? {
            level: 'reason' as const,
            title:
              item.source === 'daylight'
                ? 'Decline this takedown notice'
                : 'Decline this report',
            body:
              item.source === 'daylight'
                ? 'The content stays up and the claimant is not acted on. Say why.'
                : 'The listing stays as it is. Say why the report is declined.',
            confirmLabel: 'Decline',
          }
        : {
            level: 'reason' as const,
            title: 'Uphold this takedown notice',
            body: 'The contributions the notice names are taken down. Say why.',
            confirmLabel: 'Uphold notice',
            destructive: true,
          };
    const result = await this.confirm.confirm(options);
    if (!result.confirmed) return;
    this.queue.act(item, action, result.reason).subscribe({
      next: () => this.message.set('Done.'),
      error: () =>
        this.message.set('That action could not be completed. Try again.'),
    });
  }
}
