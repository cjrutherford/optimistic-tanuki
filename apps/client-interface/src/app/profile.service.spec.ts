import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileDto, ProfileTelosDto } from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthStateService,
          useValue: {
            getDecodedTokenValue: jest.fn(),
            getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getCurrentUserProfile', () => {
    it('should return the current user profile', () => {
      const mockProfile: ProfileDto = {
        id: '1',
        userId: '123',
        profileName: 'Test User',
        profilePic: '',
        coverPic: '',
        bio: '',
        occupation: '',
        location: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      };
      service.currentUserProfile.set(mockProfile);

      const result = service.getCurrentUserProfile();

      expect(result).toEqual(mockProfile);
    });

    it('should return null if no current user profile is set', () => {
      service.currentUserProfile.set(null);

      const result = service.getCurrentUserProfile();

      expect(result).toBeNull();
    });
  });

  describe('character sheet config', () => {
    it('should load enabled and grounded skin from app config', async () => {
      const promise = service.loadCharacterSheetConfig();
      const req = httpMock.expectOne(
        'http://localhost:3000/app-config/by-name/client-interface'
      );
      req.flush({
        features: {
          profile: {
            characterSheet: {
              enabled: true,
              skin: 'grounded',
            },
          },
        },
      });

      const config = await promise;

      expect(service.isCharacterSheetEnabled()).toBe(true);
      expect(service.characterSheetSkin()).toBe('grounded');
      expect(config).toEqual({
        enabled: true,
        skin: 'grounded',
      });
    });

    it('should default to fantasy skin when app config omits it', async () => {
      const promise = service.loadCharacterSheetConfig();
      const req = httpMock.expectOne(
        'http://localhost:3000/app-config/by-name/client-interface'
      );
      req.flush({
        features: {
          profile: {
            characterSheet: {
              enabled: false,
            },
          },
        },
      });

      const config = await promise;

      expect(service.isCharacterSheetEnabled()).toBe(false);
      expect(service.characterSheetSkin()).toBe('fantasy');
      expect(config).toEqual({
        enabled: false,
        skin: 'fantasy',
      });
    });
  });

  describe('getProfileTelos', () => {
    it('should fetch and store the current profile telos document', async () => {
      const mockProfile: ProfileDto = {
        id: '1',
        userId: '123',
        profileName: 'Test User',
        profilePic: '',
        coverPic: '',
        bio: '',
        occupation: '',
        location: '',
        interests: '',
        skills: '',
        created_at: new Date(),
      };
      const telos = {
        id: 'telos-1',
        profileId: '1',
        name: 'Test User',
        description: 'desc',
        projects: [],
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: 'goal',
        overallProfileSummary: 'summary',
        generationStatus: 'ready',
        sourceCount: 2,
        characterSheet: {
          classKey: 'navigator',
          classLabel: 'Navigator',
          archetypeSummary: 'Finds a path quickly.',
          level: 4,
          stats: {
            strength: 10,
            dexterity: 14,
            constitution: 11,
            intelligence: 13,
            wisdom: 15,
            charisma: 9,
          },
          traits: ['Prepared'],
        },
      } as ProfileTelosDto;

      service.currentUserProfile.set(mockProfile);

      const promise = service.getProfileTelos();
      const req = httpMock.expectOne('http://localhost:3000/profile/1/telos');
      req.flush(telos);

      const result = await promise;

      expect(result).toEqual(telos);
      expect(service.currentProfileTelos()).toEqual(telos);
    });
  });
});
