import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const authStateService = {
    restoreSession: jest.fn().mockResolvedValue(false),
    isAuthenticated: true,
    getDecodedTokenValue: jest.fn(() => ({ profileId: 'profile-1' })),
  };
  const profileService = {
    getAllProfiles: jest.fn().mockResolvedValue([]),
    getCurrentUserProfiles: jest.fn(() => [
      { id: 'profile-1', profileName: 'Test profile' },
    ]),
    selectProfile: jest.fn(),
  };
  const router = { navigate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
        {
          provide: ThemeService,
          useValue: { themeColors$: of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('continues into the feed when a cookie session restores on login startup', async () => {
    authStateService.restoreSession.mockResolvedValue(true);
    jest
      .spyOn(component as any, 'loadOAuthConfig')
      .mockResolvedValue(undefined);

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(authStateService.restoreSession).toHaveBeenCalled();
    expect(profileService.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1' })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/feed']);
  });
});
