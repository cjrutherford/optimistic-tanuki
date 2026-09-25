import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AccountComponent } from './account.component';
import { AuthStateService } from '../../services/auth-state.service';
import { CommunityService } from '../../services/community.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';

describe('AccountComponent profile section', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;
  let router: Router;

  const profile = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Ada Member',
    profilePic: '',
    coverPic: '',
    bio: 'Towne Square regular',
    location: 'Savannah, GA',
    occupation: 'Vendor',
    interests: '',
    skills: '',
    created_at: new Date(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent, RouterTestingModule],
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            logout: jest.fn(),
            getActingProfileId: () => 'profile-1',
          },
        },
        {
          provide: CommunityService,
          useValue: { getMyMemberships: jest.fn().mockResolvedValue([]) },
        },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
        {
          provide: ThemeService,
          useValue: {
            availablePersonalities$: new BehaviorSubject([]),
            getCurrentPersonality: () => ({ id: 'bold' }),
            setPersonality: jest.fn(),
          },
        },
        {
          provide: ProfileAPIService,
          useValue: {
            profileControllerGetCurrentProfile: jest
              .fn()
              .mockReturnValue(of(profile)),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads and shows the current profile', () => {
    expect(component.currentProfile()).toEqual(profile);
    expect(component.loadingProfile()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.profile-section .profile-name')
        ?.textContent
    ).toContain('Ada Member');
  });

  it('navigates to the public profile page', () => {
    const navigate = jest.spyOn(router, 'navigate');
    component.viewMyProfile();
    expect(navigate).toHaveBeenCalledWith(['/profile', 'profile-1']);
  });
});
