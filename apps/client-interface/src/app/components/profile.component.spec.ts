import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { ProfileService } from '../profile.service';
import { of } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BannerComponent } from '@optimistic-tanuki/profile-ui';
import { CommonModule } from '@angular/common';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: ProfileService;

  const mockProfile: ProfileDto = {
    id: '1',
    profileName: 'Test Profile',
    profilePic: 'url/to/profile-pic',
    bio: 'This is a test profile',
    coverPic: 'url/to/cover-pic',
    userId: '231',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const profileServiceMock = {
      getCurrentUserProfile: jest.fn().mockReturnValue(mockProfile),
      selectProfile: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatCardModule,
        MatListModule,
        MatIconModule,
        BannerComponent,
      ],
      declarations: [],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compileComponents();

    profileService = TestBed.inject(ProfileService);
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call profileService.selectProfile on init if localStorage has selectedProfile', () => {
    const profileStringified = JSON.stringify(mockProfile);
    localStorage.setItem('selectedProfile', profileStringified);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatCardModule,
        MatListModule,
        MatIconModule,
        BannerComponent,
      ],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: jest.fn().mockReturnValue(of(mockProfile)),
            selectProfile: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    profileService = TestBed.inject(ProfileService);
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(profileService.selectProfile).toHaveBeenCalledWith({...mockProfile, created_at: mockProfile.created_at.toISOString()});
    localStorage.removeItem('selectedProfile');
  });

  it('should get the current user profile from the profile service', () => {
    const profile = component.profile;
    expect(profileService.getCurrentUserProfile).toHaveBeenCalled();
    expect(profile).toEqual(mockProfile);
  });
});