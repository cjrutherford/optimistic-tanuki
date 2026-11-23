import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { OwnerDataTableComponent } from '@optimistic-tanuki/owner-page-ui';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  ALL_TOWNS,
  FOLLOW_SWITCHER,
  ModerationQueuePageComponent,
  ageLabel,
} from './moderation-queue-page.component';
import {
  ModerationItem,
  ModerationQueueService,
  ModerationSource,
  SourceState,
} from '../services/moderation-queue.service';
import { TownContextService } from '../services/town-context.service';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';

interface QueueStub {
  states: ReturnType<typeof signal<Record<ModerationSource, SourceState>>>;
  items: ReturnType<typeof signal<ModerationItem[]>>;
  settled: ReturnType<typeof signal<boolean>>;
  load: jest.Mock;
  retry: jest.Mock;
  act: jest.Mock;
}

const ready = (): SourceState => ({
  status: 'ready',
  capped: false,
  failedTowns: [],
});

const item = (over: Partial<ModerationItem>): ModerationItem => ({
  key: 'social:s1',
  id: 's1',
  source: 'social',
  sourceLabel: 'Social',
  townId: null,
  townName: '',
  subject: 'Post p1',
  reason: 'Spam',
  reportedAt: '2026-11-01T00:00:00.000Z',
  status: 'pending',
  statusLabel: 'Pending',
  open: true,
  link: {
    commands: ['/dashboard/social-governance'],
    queryParams: { focus: 's1' },
  },
  ...over,
});

describe('ModerationQueuePageComponent', () => {
  let fixture: ComponentFixture<ModerationQueuePageComponent>;
  let component: ModerationQueuePageComponent;
  let queue: QueueStub;
  let confirm: OwnerConfirmStub;
  let router: Router;
  const selectedId = signal<string | null>(null);

  beforeEach(async () => {
    selectedId.set(null);
    queue = {
      states: signal({
        social: ready(),
        forum: ready(),
        directory: ready(),
        daylight: ready(),
      }),
      items: signal([
        item({}),
        item({
          key: 'directory:t1:r1',
          id: 'r1',
          source: 'directory',
          sourceLabel: 'Directory listing',
          townId: 't1',
          townName: 'Aspen',
          link: {
            commands: ['/dashboard/towns', 't1', 'directory-listing-reports'],
            queryParams: { focus: 'r1' },
          },
        }),
        item({
          key: 'daylight:n1',
          id: 'n1',
          source: 'daylight',
          sourceLabel: 'Daylight takedown',
          link: null,
        }),
      ]),
      settled: signal(true),
      load: jest.fn(),
      retry: jest.fn(),
      act: jest.fn(() => of({})),
    };
    confirm = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [ModerationQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ModerationQueueService, useValue: queue },
        { provide: OwnerConfirmService, useValue: confirm },
        {
          provide: TownContextService,
          useValue: {
            towns: signal([{ id: 't1', name: 'Aspen', subtitle: '' }]),
            status: signal('ready'),
            selectedId,
            load: jest.fn(),
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ModerationQueuePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads once with all towns and open reports', () => {
    expect(queue.load).toHaveBeenCalledWith({
      townId: null,
      includeClosed: false,
    });
  });

  it('reloads for the chosen town, following the switcher, and for All', () => {
    component.setTown('t1');
    fixture.detectChanges();
    expect(queue.load).toHaveBeenLastCalledWith({
      townId: 't1',
      includeClosed: false,
    });

    selectedId.set('t9');
    component.setTown(FOLLOW_SWITCHER);
    fixture.detectChanges();
    expect(queue.load).toHaveBeenLastCalledWith({
      townId: 't9',
      includeClosed: false,
    });

    component.setTown(ALL_TOWNS);
    component.setStatus('all');
    fixture.detectChanges();
    expect(queue.load).toHaveBeenLastCalledWith({
      townId: null,
      includeClosed: true,
    });
  });

  it('filters rows by source and text', () => {
    expect(component.rows()?.length).toBe(3);
    component.setSources('directory', true);
    expect(component.rows()?.map((r) => r.id)).toEqual(['r1']);
    component.setSources('directory', false);
    component.text.set('aspen');
    expect(component.rows()?.map((r) => r.id)).toEqual(['r1']);
  });

  it('shows no rows until every source has answered', () => {
    queue.settled.set(false);
    expect(component.rows()).toBeNull();
  });

  it('shows an Unavailable notice with Retry for a failed source', () => {
    queue.states.update((s) => ({
      ...s,
      forum: {
        status: 'unavailable',
        error: 'Could not be loaded',
        capped: false,
        failedTowns: [],
      },
    }));
    fixture.detectChanges();
    const notice = fixture.nativeElement.querySelector('.source-notice');
    expect(notice.textContent).toContain('Forum');
    expect(notice.textContent).toContain('Unavailable');
    notice.querySelector('button').click();
    expect(queue.retry).toHaveBeenCalledWith('forum');
    // The other sources still produce rows.
    expect(component.rows()?.length).toBe(3);
  });

  it('notes capped sources', () => {
    queue.states.update((s) => ({
      ...s,
      directory: { ...ready(), capped: true },
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'more reports may exist'
    );
  });

  it('opens the existing page for a row with its focus parameters', () => {
    const table = fixture.debugElement.query(
      By.directive(OwnerDataTableComponent)
    );
    table.componentInstance.rowClick.emit(queue.items()[1]);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/dashboard/towns', 't1', 'directory-listing-reports'],
      { queryParams: { focus: 'r1' } }
    );
    table.componentInstance.rowClick.emit(queue.items()[0]);
    expect(router.navigate).toHaveBeenLastCalledWith(
      ['/dashboard/social-governance'],
      { queryParams: { focus: 's1' } }
    );
  });

  it('does not navigate for a row with no page', () => {
    (router.navigate as jest.Mock).mockClear();
    component.open(queue.items()[2]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('quick action confirmation levels', () => {
    const run = async (
      i: ModerationItem,
      action: 'dismiss' | 'decline' | 'uphold'
    ) => {
      await component.runAction(i, action);
      return confirm.confirm.mock.calls.at(-1)?.[0];
    };

    it('dismissing a content report is a plain confirm', async () => {
      const options = await run(queue.items()[0], 'dismiss');
      expect(options?.level).toBe('plain');
      expect(queue.act).toHaveBeenCalledWith(
        queue.items()[0],
        'dismiss',
        'test reason'
      );
    });

    it('declining a listing report asks for a reason', async () => {
      const options = await run(queue.items()[1], 'decline');
      expect(options?.level).toBe('reason');
    });

    it('upholding a takedown asks for a reason and is destructive', async () => {
      const options = await run(queue.items()[2], 'uphold');
      expect(options?.level).toBe('reason');
      expect(options?.destructive).toBe(true);
    });

    it('does nothing when the owner cancels', async () => {
      confirm.confirm.mockResolvedValue({ confirmed: false });
      await run(queue.items()[0], 'dismiss');
      expect(queue.act).not.toHaveBeenCalled();
    });
  });
});

describe('ageLabel', () => {
  const now = new Date('2026-11-10T12:00:00Z').getTime();
  it('words the age', () => {
    expect(ageLabel('2026-11-07T12:00:00Z', now)).toBe('3 days ago');
    expect(ageLabel('2026-11-10T11:00:00Z', now)).toBe('1 hour ago');
    expect(ageLabel('2026-11-10T11:55:00Z', now)).toBe('5 minutes ago');
    expect(ageLabel('2026-11-10T11:59:50Z', now)).toBe('just now');
    expect(ageLabel(null, now)).toBe('');
  });
});
