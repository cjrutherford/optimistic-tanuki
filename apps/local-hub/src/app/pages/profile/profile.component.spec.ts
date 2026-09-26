import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { AuthStateService } from '../../services/auth-state.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let profiles: {
    profileControllerGetProfileById: jest.Mock;
    profileControllerGetCurrentProfile: jest.Mock;
  };

  const profile = {
    id: 'profile-1',
    userId: 'user-1',
    profileName: 'Ada Seller',
    profilePic: '',
    coverPic: '',
    bio: 'Sells vintage lamps',
    location: 'Savannah, GA',
    occupation: 'Vendor',
    interests: 'lamps',
    skills: 'haggling',
    created_at: new Date(),
  };

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'profile-1' }));
    profiles = {
      profileControllerGetProfileById: jest.fn().mockReturnValue(of(profile)),
      profileControllerGetCurrentProfile: jest
        .fn()
        .mockReturnValue(of(profile)),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
        { provide: ProfileAPIService, useValue: profiles },
        {
          provide: AuthStateService,
          useValue: { getActingProfileId: () => 'profile-9' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the profile from the route id', () => {
    expect(profiles.profileControllerGetProfileById).toHaveBeenCalledWith(
      'profile-1'
    );
    expect(component.profile()).toEqual(profile);
    expect(component.loading()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.profile-info h1')?.textContent
    ).toContain('Ada Seller');
  });

  it('marks the profile as your own when ids match', async () => {
    paramMap$.next(convertToParamMap({ id: 'profile-9' }));
    await fixture.whenStable();
    profiles.profileControllerGetProfileById.mockReturnValue(
      of({ ...profile, id: 'profile-9' })
    );
    await component.loadProfile('profile-9');
    fixture.detectChanges();
    expect(component.isOwnProfile()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.own-badge')?.textContent
    ).toContain('This is you');
  });

  it('shows an error when the profile cannot load', async () => {
    profiles.profileControllerGetProfileById.mockImplementationOnce(() => {
      throw new Error('nope');
    });
    await component.loadProfile('missing');
    fixture.detectChanges();
    expect(component.error()).toMatch(/could not load/i);
    expect(fixture.nativeElement.querySelector('.error-state')).not.toBeNull();
  });
});
