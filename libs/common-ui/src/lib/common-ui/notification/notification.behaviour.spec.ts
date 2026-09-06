import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { EventEmitter } from '@angular/core';

import {
  Notification,
  NotificationComponent,
  NotificationType,
} from './notification.component';

/**
 * The spec beside this one covers rendering. These drive the component's
 * logic: the dismissal and read bookkeeping, the auto-dismiss timers, and the
 * deprecated inputs that are still wired to their modern equivalents.
 */
describe('NotificationComponent behaviour', () => {
  let component: NotificationComponent;

  const note = (overrides: Partial<Notification> = {}): Notification => ({
    id: 'n-1',
    message: 'Something happened',
    type: 'info',
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationComponent],
    }).compileComponents();

    component = TestBed.createComponent(
      NotificationComponent
    ).componentInstance;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('unread bookkeeping', () => {
    it('counts only the unread notifications', () => {
      component.notifications = [
        note({ id: 'a' }),
        note({ id: 'b', read: true }),
        note({ id: 'c' }),
      ];

      expect(component.unreadCount).toBe(2);
      expect(component.hasUnread).toBe(true);
    });

    it('reports no unread once every notification is read', () => {
      component.notifications = [note({ id: 'a', read: true })];

      expect(component.unreadCount).toBe(0);
      expect(component.hasUnread).toBe(false);
    });

    it('marks one as read and announces it', () => {
      const read = jest.fn();
      component.notificationRead.subscribe(read);
      component.notifications = [note({ id: 'a' }), note({ id: 'b' })];

      component.markAsRead('b');

      expect(component.notifications[1].read).toBe(true);
      expect(read).toHaveBeenCalledWith('b');
    });

    it('ignores a read for an id it does not hold', () => {
      const read = jest.fn();
      component.notificationRead.subscribe(read);
      component.notifications = [note({ id: 'a' })];

      component.markAsRead('missing');

      expect(read).not.toHaveBeenCalled();
    });

    it('marks all unread as read, announcing only those it changed', () => {
      const read = jest.fn();
      component.notificationRead.subscribe(read);
      component.notifications = [
        note({ id: 'a' }),
        note({ id: 'b', read: true }),
      ];

      component.markAllAsRead();

      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith('a');
    });
  });

  describe('visible notifications', () => {
    it('caps the list at maxNotifications', () => {
      component.maxNotifications = 2;
      component.notifications = [
        note({ id: 'a' }),
        note({ id: 'b' }),
        note({ id: 'c' }),
      ];

      expect(component.visibleNotifications.map((n) => n.id)).toEqual([
        'a',
        'b',
      ]);
    });

    it('shows the single notification alone when one is set', () => {
      component.notification = note({ id: 'solo' });
      component.notifications = [note({ id: 'a' })];

      expect(component.isSingleMode).toBe(true);
      expect(component.visibleNotifications.map((n) => n.id)).toEqual(['solo']);
    });
  });

  describe('dismissal', () => {
    it('removes a notification from the list and announces it', () => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      component.notifications = [note({ id: 'a' }), note({ id: 'b' })];

      component.dismissNotification('a');

      expect(component.notifications.map((n) => n.id)).toEqual(['b']);
      expect(dismissed).toHaveBeenCalledWith('a');
    });

    it('clears the single notification rather than filtering the list', () => {
      component.notification = note({ id: 'solo' });
      component.notifications = [note({ id: 'a' })];

      component.dismissNotification('solo');

      expect(component.notification).toBeUndefined();
      // The list is left untouched — only the single slot was cleared.
      expect(component.notifications.map((n) => n.id)).toEqual(['a']);
    });

    it('dismisses every notification', () => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      component.notifications = [note({ id: 'a' }), note({ id: 'b' })];

      component.dismissAll();

      expect(component.notifications).toEqual([]);
      expect(dismissed).toHaveBeenCalledTimes(2);
    });
  });

  describe('auto-dismiss', () => {
    it('dismisses after the notification’s own duration', fakeAsync(() => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      component.notifications = [note({ id: 'a', autoDismiss: 1000 })];

      component.ngOnInit();
      tick(999);
      expect(dismissed).not.toHaveBeenCalled();

      tick(1);
      expect(dismissed).toHaveBeenCalledWith('a');
    }));

    it('falls back to the component default when the notification sets none', fakeAsync(() => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      component.autoDismiss = 500;
      component.notifications = [note({ id: 'a' })];

      component.ngOnInit();
      tick(500);

      expect(dismissed).toHaveBeenCalledWith('a');
    }));

    it.each([
      ['the duration is zero', { autoDismiss: 0 }],
      [
        'the notification is not closable',
        { autoDismiss: 1000, closable: false },
      ],
    ])(
      'schedules nothing when %s',
      fakeAsync((_case: string, extra: Partial<Notification>) => {
        const dismissed = jest.fn();
        component.dismiss.subscribe(dismissed);
        component.autoDismiss = 0;
        component.notifications = [note({ id: 'a', ...extra })];

        component.ngOnInit();
        tick(5000);

        expect(dismissed).not.toHaveBeenCalled();
      })
    );

    it('cancels pending timers on destroy', fakeAsync(() => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      component.notifications = [note({ id: 'a', autoDismiss: 1000 })];
      component.ngOnInit();

      component.ngOnDestroy();
      tick(2000);

      expect(dismissed).not.toHaveBeenCalled();
    }));
  });

  describe('actions', () => {
    it('runs the action callback and announces which one ran', () => {
      const clicked = jest.fn();
      component.actionClicked.subscribe(clicked);
      const callback = jest.fn();
      const withAction = note({
        id: 'a',
        actions: [{ label: 'Undo', callback }],
      });

      component.onActionClick(withAction, 0);

      expect(callback).toHaveBeenCalled();
      expect(clicked).toHaveBeenCalledWith({ id: 'a', actionIndex: 0 });
    });

    it('does nothing for an action index that does not exist', () => {
      const clicked = jest.fn();
      component.actionClicked.subscribe(clicked);

      component.onActionClick(note({ id: 'a' }), 3);

      expect(clicked).not.toHaveBeenCalled();
    });
  });

  describe('bell menu', () => {
    it('announces the click only when opening', () => {
      const bell = jest.fn();
      component.bellClick.subscribe(bell);

      component.toggleMenu();
      expect(component.menuVisible).toBe(true);
      expect(bell).toHaveBeenCalledTimes(1);

      component.toggleMenu();
      expect(component.menuVisible).toBe(false);
      expect(bell).toHaveBeenCalledTimes(1);
    });
  });

  describe('utilities', () => {
    const types: NotificationType[] = [
      'info',
      'success',
      'warning',
      'error',
      'neutral',
    ];

    it.each(types)('has an icon and a label for %s', (type) => {
      expect(component.getTypeIcon(type)).toBeTruthy();
      expect(component.getTypeLabel(type)).toBeTruthy();
    });

    it('falls back for a type outside the union', () => {
      const unknown = 'nonsense' as NotificationType;

      expect(component.getTypeIcon(unknown)).toBe('🔔');
      expect(component.getTypeLabel(unknown)).toBe('Notification');
    });

    it('tracks by id, falling back to the index when there is none', () => {
      expect(component.trackById(4, note({ id: 'a' }))).toBe('a');
      expect(component.trackById(4, note({ id: '' }))).toBe(4);
    });
  });

  describe('deprecated inputs', () => {
    it.each([
      ['top', 'top-right'],
      ['bottom', 'bottom-right'],
      ['left', 'top-left'],
      ['right', 'top-right'],
      ['sideways', 'top-right'],
    ])('maps legacy placement %s onto position %s', (legacy, expected) => {
      component.placement = legacy as 'top' | 'bottom' | 'left' | 'right';

      expect(component.position).toBe(expected);
      expect(component.placement).toBe(legacy);
      expect(console.warn).toHaveBeenCalled();
    });

    it('routes the legacy autoDismissDefault onto autoDismiss', () => {
      component.autoDismissDefault = 250;

      expect(component.autoDismiss).toBe(250);
      expect(console.warn).toHaveBeenCalled();
    });

    it('re-emits legacy notificationCleared through dismiss', () => {
      const dismissed = jest.fn();
      component.dismiss.subscribe(dismissed);
      const legacy = new EventEmitter<number>();

      component.notificationCleared = legacy;
      component.notifications = [note({ id: 7 })];
      component.dismissNotification(7);

      // Once from dismiss itself, once relayed back through the legacy bridge.
      expect(dismissed).toHaveBeenCalledWith(7);
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
