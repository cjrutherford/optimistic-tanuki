import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, PLATFORM_ID } from '@angular/core';
import { AppComponent } from './app.component';
import { Router, RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './profile.service';
import { ProfileContext } from './profile.context';
import { TitleService } from './title.service';
import { ChatService } from './chat.service';
import { SocketChatService } from '@optimistic-tanuki/chat-ui';
import { NotificationService } from '@optimistic-tanuki/notification-ui';
import { BehaviorSubject, of, throwError } from 'rxjs';

const themeColors = {
  background: '#0b1020',
  foreground: '#f5f7fb',
  accent: '#4fd1c5',
  complementary: '#7dd3fc',
  tertiary: '#8b5cf6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  complementaryGradients: {
    light: 'linear-gradient(#7dd3fc, #4fd1c5)',
    dark: 'linear-gradient(#4fd1c5, #7dd3fc)',
  },
};

const generatedTheme = {
  colors: {
    background: '#0b1020',
    foreground: '#f5f7fb',
    primary: '#4fd1c5',
    secondary: '#7dd3fc',
    border: '#1f2a44',
  },
  fonts: {
    heading: { family: 'IBM Plex Sans' },
    body: { family: 'IBM Plex Sans' },
    mono: { family: 'IBM Plex Mono' },
  },
  personality: {
    animations: {
      easing: 'ease',
      duration: {
        fast: '150ms',
        normal: '300ms',
      },
    },
  },
};

const personality = { id: 'control-center', name: 'Control Center' };

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: {
            themeColors$: of(themeColors),
            generatedTheme$: of(generatedTheme),
            personality$: of(personality),
            getTheme: jest.fn().mockReturnValue('dark'),
            getAccentColor: jest.fn().mockReturnValue('#4fd1c5'),
            getCurrentPersonality: jest.fn().mockReturnValue(personality),
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
          },
        },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated$: of(false),
            logout: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: ProfileContext,
          useValue: {},
        },
        {
          provide: TitleService,
          useValue: {},
        },
        {
          provide: ChatService,
          useValue: {},
        },
        {
          provide: SocketChatService,
          useValue: {
            sendMessage: jest.fn(),
            onMessage: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notifications: jest.fn().mockReturnValue([]),
            unreadCount: jest.fn().mockReturnValue(0),
            loadNotifications: jest.fn(),
            markAsRead: jest.fn().mockReturnValue(of(void 0)),
            markAllAsRead: jest.fn().mockReturnValue(of(void 0)),
          },
        },
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled).toBeTruthy();
  });

  it(`should have as title 'client-interface'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('client-interface');
  });

  it('bootstraps the soft-touch personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(null);
    const themeService = TestBed.inject(ThemeService) as unknown as {
      setPersonality: jest.Mock;
    };
    themeService.setPersonality.mockClear();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(themeService.setPersonality).toHaveBeenCalledWith('soft-touch');
    getItemSpy.mockRestore();
  });

  it('renders the murmuration motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-murmuration-scene')).toBeTruthy();
  });

  it('suppresses fixed bottom overlays on dedicated mobile chat routes', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.isAuthenticated.set(true);
    app.currentPath.set('/messages');
    app.onResize();

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(app.workspaceSummary()).toBeNull();
    expect(app.suppressFixedChatOverlays()).toBe(true);
    expect(compiled.querySelector('.chat-floating-button')).toBeNull();
    expect(compiled.querySelector('hai-about-tag')).toBeNull();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
    });
  });

  it('suppresses fixed chat overlays on the desktop messages workspace', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.isAuthenticated.set(true);
    app.currentPath.set('/messages');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(app.suppressFixedChatOverlays()).toBe(true);
    expect(compiled.querySelector('.chat-floating-button')).toBeNull();
    expect(compiled.querySelector('hai-about-tag')).toBeNull();
  });

  it('sends floating-chat messages through the authenticated shared chat socket', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const socketChatService = TestBed.inject(SocketChatService) as unknown as {
      sendMessage: jest.Mock;
    };
    app.selectedProfile.set({ id: 'profile-1' } as any);
    app.chatConversations = [
      {
        id: 'conversation-1',
        participants: ['profile-1', 'profile-2'],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    app.handleFloatingMessageSubmitted({
      conversationId: 'conversation-1',
      content: 'hello',
    });

    expect(socketChatService.sendMessage).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      content: 'hello',
      senderId: 'profile-1',
      recipientId: ['profile-2'],
      type: 'chat',
    });
  });
});

describe('AppComponent behaviour', () => {
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;
  let httpMock: HttpTestingController;
  let isAuthenticated$: BehaviorSubject<boolean>;
  let onMessage: (message: unknown) => void;
  let authState: {
    isAuthenticated$: BehaviorSubject<boolean>;
    logout: jest.Mock;
  };
  let profileService: { getCurrentUserProfile: jest.Mock };
  let chatService: { getConversations: jest.Mock; startDirectChat: jest.Mock };
  let socketChatService: { sendMessage: jest.Mock; onMessage: jest.Mock };
  let notificationService: {
    notifications: jest.Mock;
    unreadCount: jest.Mock;
    loadNotifications: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
  };
  let navigate: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const conversation = (id: string, participants: string[]) => ({
    id,
    title: `Conversation ${id}`,
    type: 'direct' as const,
    participants,
    isDeleted: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    isAuthenticated$ = new BehaviorSubject<boolean>(false);
    authState = { isAuthenticated$, logout: jest.fn() };
    profileService = {
      getCurrentUserProfile: jest.fn().mockReturnValue({ id: 'profile-1' }),
    };
    chatService = {
      getConversations: jest.fn().mockResolvedValue([]),
      startDirectChat: jest.fn(),
    };
    socketChatService = {
      sendMessage: jest.fn(),
      onMessage: jest.fn((cb: (message: unknown) => void) => {
        onMessage = cb;
      }),
    };
    notificationService = {
      notifications: jest.fn().mockReturnValue([]),
      unreadCount: jest.fn().mockReturnValue(0),
      loadNotifications: jest.fn(),
      markAsRead: jest.fn().mockReturnValue(of(void 0)),
      markAllAsRead: jest.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: {
            themeColors$: of(themeColors),
            generatedTheme$: of(generatedTheme),
            personality$: of(personality),
            getTheme: jest.fn().mockReturnValue('dark'),
            getAccentColor: jest.fn().mockReturnValue('#4fd1c5'),
            getCurrentPersonality: jest.fn().mockReturnValue(personality),
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
          },
        },
        { provide: AuthStateService, useValue: authState },
        { provide: ProfileService, useValue: profileService },
        { provide: ProfileContext, useValue: {} },
        { provide: TitleService, useValue: {} },
        { provide: ChatService, useValue: chatService },
        { provide: SocketChatService, useValue: socketChatService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('workspaceSummary', () => {
    it('is null while signed out', () => {
      expect(app.workspaceSummary()).toBeNull();
    });

    it.each([
      ['/communities', 'Communities'],
      ['/communities/abc', 'Communities'],
      ['/forum', 'Forum'],
      ['/settings', 'Account'],
      ['/notifications', 'Account'],
      ['/feed', 'Feed'],
      ['/anything-else', 'Feed'],
    ])('describes %s as %s', (url, eyebrow) => {
      app.isAuthenticated.set(true);
      app.currentPath.set(url);
      expect(app.workspaceSummary()?.eyebrow).toBe(eyebrow);
    });

    it('is null on the messages workspace', () => {
      app.isAuthenticated.set(true);
      app.currentPath.set('/messages');
      expect(app.workspaceSummary()).toBeNull();
    });
  });

  describe('suppressFixedChatOverlays', () => {
    it('is false on a desktop community chat route', () => {
      app.isMobileViewport.set(false);
      app.currentPath.set('/communities/abc/chat');
      expect(app.suppressFixedChatOverlays()).toBe(false);
    });

    it('is true on a mobile community chat route', () => {
      app.isMobileViewport.set(true);
      app.currentPath.set('/communities/abc/chat');
      expect(app.suppressFixedChatOverlays()).toBe(true);
    });
  });

  describe('reducedMotion', () => {
    it('follows the prefers-reduced-motion media query', () => {
      const matchMedia = jest
        .fn()
        .mockReturnValue({ matches: true } as MediaQueryList);
      const original = window.matchMedia;
      (window as unknown as { matchMedia: unknown }).matchMedia = matchMedia;

      expect(app.reducedMotion).toBe(true);
      expect(matchMedia).toHaveBeenCalledWith(
        '(prefers-reduced-motion: reduce)'
      );

      (window as unknown as { matchMedia: unknown }).matchMedia = original;
    });

    it('is false when the browser has no matchMedia', () => {
      const original = window.matchMedia;
      (window as unknown as { matchMedia: unknown }).matchMedia = undefined;

      expect(app.reducedMotion).toBe(false);

      (window as unknown as { matchMedia: unknown }).matchMedia = original;
    });
  });

  describe('authentication stream', () => {
    it('loads the selected profile and notifications once authenticated', () => {
      isAuthenticated$.next(true);

      expect(app.isAuthenticated()).toBe(true);
      expect(app.selectedProfile()).toEqual({ id: 'profile-1' });
      expect(notificationService.loadNotifications).toHaveBeenCalledWith(
        'profile-1'
      );
      expect(app.navItems().length).toBeGreaterThan(0);
    });
  });

  describe('navigation', () => {
    it('toggles the nav open and closed', () => {
      expect(app.isNavExpanded()).toBe(false);
      app.toggleNav();
      expect(app.isNavExpanded()).toBe(true);
      app.toggleNav();
      expect(app.isNavExpanded()).toBe(false);
    });

    it('navigates and collapses the nav', () => {
      app.isNavExpanded.set(true);
      app.navigateTo('/feed');
      expect(navigate).toHaveBeenCalledWith(['/feed']);
      expect(app.isNavExpanded()).toBe(false);
    });

    it('logs out and returns to login when authenticated', () => {
      app.isAuthenticated.set(true);
      app.loginOutButton();
      expect(authState.logout).toHaveBeenCalled();
      expect(app.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('just goes to login when signed out', () => {
      app.loginOutButton();
      expect(authState.logout).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it.each([
      ['user', ['/profile', 'x']],
      ['post', ['/feed/post', 'x']],
      ['community', ['/communities', 'x']],
    ])('routes a %s search result', (type, expected) => {
      app.onSearchResultClick({ type, id: 'x' } as never);
      expect(navigate).toHaveBeenCalledWith(expected);
    });

    it('ignores an unroutable search result', () => {
      navigate.mockClear();
      app.onSearchResultClick({ type: 'other', id: 'x' } as never);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('unsubscribes the url subscription on destroy', () => {
      const unsubscribe = jest.fn();
      (app as unknown as { urlSub: { unsubscribe: jest.Mock } }).urlSub = {
        unsubscribe,
      };
      app.ngOnDestroy();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('viewport', () => {
    it('tracks a narrow viewport on resize', () => {
      const original = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 390,
      });
      app.onResize();
      expect(app.isMobileViewport()).toBe(true);

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1280,
      });
      app.onResize();
      expect(app.isMobileViewport()).toBe(false);

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: original,
      });
    });
  });

  describe('chat', () => {
    it('loads chat data the first time the panel opens', async () => {
      app.toggleChat();
      expect(app.showChat()).toBe(true);
      await Promise.resolve();
      expect(chatService.getConversations).toHaveBeenCalledWith('profile-1');
    });

    it('closes the panel without reloading', () => {
      app.showChat.set(true);
      app.toggleChat();
      expect(app.showChat()).toBe(false);
      expect(chatService.getConversations).not.toHaveBeenCalled();
    });

    it('does nothing without a current profile', async () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      await app.loadChatData();
      expect(chatService.getConversations).not.toHaveBeenCalled();
    });

    it('maps conversations with no participants without fetching profiles', async () => {
      chatService.getConversations.mockResolvedValue([
        { ...conversation('c1', []), participants: [] },
      ]);

      await app.loadChatData();

      expect(app.chatContacts).toEqual([]);
      expect(app.chatConversations).toHaveLength(1);
      expect(app.chatInitialized()).toBe(true);
      httpMock.verify();
    });

    it('names each conversation after the other participant', async () => {
      chatService.getConversations.mockResolvedValue([
        conversation('c1', ['profile-1', 'profile-2']),
        conversation('c2', ['profile-1', 'profile-3']),
      ]);

      const pending = app.loadChatData();
      await Promise.resolve();
      await Promise.resolve();

      const req = httpMock.expectOne('/api/profile/by-ids');
      expect(req.request.body.ids).toEqual(
        expect.arrayContaining(['profile-1', 'profile-2', 'profile-3'])
      );
      req.flush([{ id: 'profile-2', profileName: 'Bob', profilePic: 'pic' }]);
      await pending;

      expect(app.chatContacts).toEqual([
        { id: 'c1', name: 'Bob', profilePic: 'pic' },
        { id: 'c2', name: 'Conversation c2', profilePic: undefined },
      ]);
      expect(app.chatInitialized()).toBe(true);
    });

    it('logs a chat loading failure', async () => {
      chatService.getConversations.mockRejectedValue(new Error('down'));

      await app.loadChatData();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load chat data:',
        expect.any(Error)
      );
      expect(app.chatInitialized()).toBe(false);
    });

    it('appends an incoming socket message to the matching conversation', () => {
      app.chatConversations = [
        {
          id: 'c1',
          participants: ['profile-1'],
          messages: [],
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: 'c2',
          participants: ['profile-1'],
          messages: [],
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ];

      onMessage({
        id: 'm1',
        conversationId: 'c1',
        content: 'hi',
        timestamp: new Date(1),
      });

      expect(app.chatConversations[0].messages).toHaveLength(1);
      expect(app.chatConversations[1].messages).toHaveLength(0);
    });

    it('ignores a socket message it has already stored', () => {
      app.chatConversations = [
        {
          id: 'c1',
          participants: ['profile-1'],
          messages: [{ id: 'm1' } as never],
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ];

      onMessage({ id: 'm1', conversationId: 'c1', content: 'hi' });

      expect(app.chatConversations[0].messages).toHaveLength(1);
    });

    it('ignores a floating message with no sender or unknown conversation', () => {
      app.selectedProfile.set(null);
      app.handleFloatingMessageSubmitted({
        conversationId: 'c1',
        content: 'hi',
      });
      expect(socketChatService.sendMessage).not.toHaveBeenCalled();

      app.selectedProfile.set({ id: 'profile-1' } as never);
      app.chatConversations = [];
      app.handleFloatingMessageSubmitted({
        conversationId: 'c1',
        content: 'hi',
      });
      expect(socketChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('does nothing when there is no current profile to chat as', async () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);

      await app.startChatWithUser('profile-2');

      expect(errorSpy).toHaveBeenCalledWith('No current profile found');
      expect(chatService.startDirectChat).not.toHaveBeenCalled();
    });

    it('reports a failure to start a direct chat', async () => {
      chatService.startDirectChat.mockRejectedValue(new Error('nope'));

      await app.startChatWithUser('profile-2');

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to start chat:',
        expect.any(Error)
      );
    });

    // NOTE: openChat() currently calls itself with the same id whenever the
    // contact is found, so it only terminates for an unknown conversation.
    // Only the terminating branch is exercised here on purpose.
    it('openChat is a no-op for an unknown conversation', async () => {
      app.chatContacts = [];
      await expect(app.openChat('missing')).resolves.toBeUndefined();
    });
  });

  describe('notifications', () => {
    it('does nothing without a current profile', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      app.loadNotifications();
      expect(notificationService.loadNotifications).not.toHaveBeenCalled();
    });

    it('mirrors the service signals onto the component signals', () => {
      notificationService.notifications.mockReturnValue([{ id: 'n1' }]);
      notificationService.unreadCount.mockReturnValue(3);

      app.loadNotifications();

      expect(app.notifications()).toEqual([{ id: 'n1' }]);
      expect(app.unreadCount()).toBe(3);
    });

    it('navigates to the notification target and marks it read', () => {
      app.onNotificationClick({
        id: 'n1',
        actionUrl: '/feed/post/1',
        isRead: false,
      } as never);

      expect(navigate).toHaveBeenCalledWith(['/feed/post/1']);
      expect(notificationService.markAsRead).toHaveBeenCalledWith('n1');
    });

    it('does not re-mark an already read notification', () => {
      navigate.mockClear();
      app.onNotificationClick({ id: 'n1', isRead: true } as never);

      expect(navigate).not.toHaveBeenCalled();
      expect(notificationService.markAsRead).not.toHaveBeenCalled();
    });

    it('logs a failure to mark a notification read', () => {
      notificationService.markAsRead.mockReturnValue(
        throwError(() => new Error('nope'))
      );

      app.onNotificationClick({ id: 'n1', isRead: false } as never);

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to mark notification as read:',
        expect.any(Error)
      );
    });

    it('marks everything read for the current profile', () => {
      app.onMarkAllRead();
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith(
        'profile-1'
      );
    });

    it('does not mark everything read without a profile', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      app.onMarkAllRead();
      expect(notificationService.markAllAsRead).not.toHaveBeenCalled();
    });

    it('logs a failure to mark everything read', () => {
      notificationService.markAllAsRead.mockReturnValue(
        throwError(() => new Error('nope'))
      );

      app.onMarkAllRead();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to mark all as read:',
        expect.any(Error)
      );
    });
  });
});
