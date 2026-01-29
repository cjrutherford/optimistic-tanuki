import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile/profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ThemeService, ColorPalette } from '@optimistic-tanuki/theme-lib';
import { of, BehaviorSubject, Subject, throwError } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { signal } from '@angular/core';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let router: Router;
  let authStateService: jest.Mocked<Partial<AuthStateService>>;
  let profileService: jest.Mocked<Partial<ProfileService>>;
  let messageService: jest.Mocked<Partial<MessageService>>;
  let themeService: jest.Mocked<Partial<ThemeService>>;
  let routerEventsSubject: Subject<any>;
  let isAuthenticatedSubject: BehaviorSubject<boolean>;
  let themeColorsSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    routerEventsSubject = new Subject<any>();
    isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    themeColorsSubject = new BehaviorSubject<any>({ tertiary: '#ff0000' });

    authStateService = {
      isAuthenticated$: jest.fn(() => isAuthenticatedSubject.asObservable()),
      logout: jest.fn(),
      getPersistedSelectedProfile: jest.fn(() => ({ id: 'prof1' } as any))
    };

    profileService = {
      currentUserProfile: signal<any>({ id: 'p1' }),
      getCurrentUserProfile: jest.fn(() => ({ id: 'p1' } as any))
    } as any;

    messageService = {
      messages: signal<any>([]),
      addMessage: jest.fn()
    } as any;

    themeService = {
      getCurrentPalette: jest.fn(() => undefined),
      setPalette: jest.fn(),
      getTheme: jest.fn(() => 'light'),
      setTheme: jest.fn(),
      getAccentColor: jest.fn(() => '#000000'),
      themeColors$: themeColorsSubject.asObservable()
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
        { provide: MessageService, useValue: messageService },
        { provide: ThemeService, useValue: themeService },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    
    // Mock router.events
    Object.defineProperty(router, 'events', { value: routerEventsSubject.asObservable() });
    // Mock router.url
    Object.defineProperty(router, 'url', { value: '/' });

    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should subscribe to auth state and update nav items', () => {
      isAuthenticatedSubject.next(true);
      expect(component.isAuthenticated()).toBe(true);
      expect(component.navItems().some(i => i.label === 'Logout')).toBe(true);
    });

    it('should handle auth error', () => {
        (authStateService.isAuthenticated$ as jest.Mock).mockReturnValue(throwError(() => new Error('Auth Error')));
        component.ngOnInit();
        expect(messageService.addMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('should update nav items on navigation end', () => {
        const spy = jest.spyOn(component, 'updateNavItems');
        routerEventsSubject.next(new NavigationEnd(1, '/', '/'));
        expect(spy).toHaveBeenCalled();
    });

    it('should execute actions in nav items when authenticated', () => {
        isAuthenticatedSubject.next(true);
        fixture.detectChanges();
        
        const logoutItem = component.navItems().find(i => i.label === 'Logout');
        const projectsItem = component.navItems().find(i => i.label === 'Projects');
        const forumItem = component.navItems().find(i => i.label === 'Forum');
        const profileItem = component.navItems().find(i => i.label === 'My Profile');
        const settingsItem = component.navItems().find(i => i.label === 'Settings');

        const navigateSpy = jest.spyOn(router, 'navigate');
        const logoutSpy = jest.spyOn(component, 'loginOutButton');

        logoutItem?.action?.();
        expect(logoutSpy).toHaveBeenCalled();

        projectsItem?.action?.();
        expect(navigateSpy).toHaveBeenCalledWith(['/']);

        forumItem?.action?.();
        expect(navigateSpy).toHaveBeenCalledWith(['/forum']);

        profileItem?.action?.();
        expect(navigateSpy).toHaveBeenCalledWith(['/profile']);

        settingsItem?.action?.();
        expect(navigateSpy).toHaveBeenCalledWith(['/settings']);
    });

    it('should execute actions in nav items when NOT authenticated', () => {
        isAuthenticatedSubject.next(false);
        fixture.detectChanges();

        const loginItem = component.navItems().find(i => i.label === 'Login');
        const registerItem = component.navItems().find(i => i.label === 'Register');

        const navigateSpy = jest.spyOn(router, 'navigate');
        const loginOutSpy = jest.spyOn(component, 'loginOutButton');

        loginItem?.action?.();
        expect(loginOutSpy).toHaveBeenCalled();

        registerItem?.action?.();
        expect(navigateSpy).toHaveBeenCalledWith(['/register']);
    });

    it('should initialize theme in browser', () => {
        expect(themeService.setPalette).toHaveBeenCalledWith('Forest Dream');
        expect(themeService.setTheme).toHaveBeenCalled();
    });
  });

  describe('Navigation and Actions', () => {
    it('navigateTo should call router.navigate', () => {
      const spy = jest.spyOn(router, 'navigate');
      component.navigateTo('/test');
      expect(spy).toHaveBeenCalledWith(['/test']);
    });

    it('loginOutButton should logout if authenticated', () => {
        component.isAuthenticated.set(true);
        const spy = jest.spyOn(router, 'navigate');
        component.loginOutButton();
        expect(authStateService.logout).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(['/login']);
    });

    it('loginOutButton should navigate to login if NOT authenticated', () => {
        component.isAuthenticated.set(false);
        const spy = jest.spyOn(router, 'navigate');
        component.loginOutButton();
        expect(spy).toHaveBeenCalledWith(['/login']);
    });

    it('showModal should toggle isModalOpen', () => {
        const initial = component.isModalOpen();
        component.showModal();
        expect(component.isModalOpen()).toBe(!initial);
    });
  });

  describe('AI and Persona', () => {
    it('openAiAssistant should call chatComponent if available', () => {
        component.chatComponent = { openAiAssistantChat: jest.fn() } as any;
        component.openAiAssistant();
        expect(component.chatComponent?.openAiAssistantChat).toHaveBeenCalled();
    });

    it('openAiAssistant should show message if chatComponent NOT available', () => {
        component.chatComponent = undefined;
        component.openAiAssistant();
        expect(messageService.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Chat service is not available' }));
    });

    it('onPersonaSelected should call chatComponent if available', () => {
        component.chatComponent = { openOrCreatePersonaChat: jest.fn() } as any;
        component.onPersonaSelected({ id: 'p1', name: 'Persona 1' } as any);
        expect(component.chatComponent?.openOrCreatePersonaChat).toHaveBeenCalledWith('p1');
    });

    it('onPersonaSelected should queue messages if chatComponent NOT available', () => {
        component.chatComponent = undefined;
        component.onPersonaSelected({ id: 'p1', name: 'Persona 1' } as any);
        expect(component.newPersonaMessages().length).toBe(1);
        expect(component.newPersonaMessages()[0].content).toContain('Persona 1');
    });
  });

  describe('Theme Colors', () => {
      it('should set CSS variable when themeColors update', () => {
          const spy = jest.spyOn(document.documentElement.style, 'setProperty');
          themeColorsSubject.next({ tertiary: '#00ff00' });
          expect(spy).toHaveBeenCalledWith('--background-pattern', expect.stringContaining('url("data:image/svg+xml'));
      });
  });
});