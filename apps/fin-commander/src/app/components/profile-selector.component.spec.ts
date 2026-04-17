import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileSelectorComponent } from './profile-selector.component';
import { ProfileContext } from '../profile.context';

describe('ProfileSelectorComponent', () => {
  let fixture: ComponentFixture<ProfileSelectorComponent>;

  const financeProfile: ProfileDto = {
    id: 'finance-profile',
    userId: 'user-1',
    profileName: 'Finance Captain',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date('2026-01-01'),
    appScope: 'finance',
  };

  const profileContext = {
    currentProfiles: signal([financeProfile]),
    currentProfile: signal<ProfileDto | null>(financeProfile),
    selectProfile: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSelectorComponent],
      providers: [{ provide: ProfileContext, useValue: profileContext }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSelectorComponent);
    fixture.detectChanges();
  });

  it('renders the active finance profile in the shell selector', () => {
    expect(fixture.nativeElement.textContent).toContain('Finance Captain');
  });
});
