import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CommunityPostsComponent } from './community-posts.component';
import { CommunityService } from '../services/community.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { SocialComponentPersistenceService } from '@optimistic-tanuki/social-ui';

describe('CommunityPostsComponent', () => {
  let fixture: ComponentFixture<CommunityPostsComponent>;
  let component: CommunityPostsComponent;
  let httpMock: HttpTestingController;

  const communityServiceMock = {
    getCurrentUserProfile: jest.fn().mockRejectedValue(new Error('anonymous')),
    findBySlug: jest.fn().mockResolvedValue({
      id: 'community-1',
      name: 'Savannah, GA',
      slug: 'savannah-ga',
      memberCount: 42,
    }),
    getCommunityPosts: jest.fn().mockResolvedValue([
      {
        id: 'post-1',
        title: 'Tonight on Savannah Signal',
        content: '<p>Local highlights are streaming now.</p>',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date('2026-06-29T12:00:00.000Z'),
        crossAppCard: {
          appId: 'video-platform',
          appName: 'MetroCast',
          kind: 'channel-promotion',
          headline: 'Watch Savannah Signal tonight',
          body: 'Local updates, interviews, and replays from around Savannah.',
          ctaLabel: 'Watch on MetroCast',
          targetPath: '/c/savannah-signal',
          channelSlug: 'savannah-signal',
        },
      },
    ]),
    getProfilesByIds: jest.fn().mockResolvedValue([
      {
        id: 'profile-1',
        profileName: 'Sam Savannah',
        profilePic: '',
      },
    ]),
    getPostComments: jest.fn(),
    getUserVote: jest.fn(),
    getPostVoteCount: jest.fn(),
    getUserReaction: jest.fn(),
    getReactionCounts: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPostsComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: CommunityService,
          useValue: communityServiceMock,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) =>
                  key === 'communitySlug' ? 'savannah-ga' : null,
              },
            },
          },
        },
        {
          provide: API_BASE_URL,
          useValue: '/api',
        },
        {
          provide: SocialComponentPersistenceService,
          useValue: {
            getComponentsForPost: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityPostsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders a MetroCast watch card for posts with a cross-app channel promotion', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const req = httpMock.expectOne('/api/registry/apps');
    expect(req.request.method).toBe('GET');
    req.flush({
      apps: [
        {
          appId: 'video-platform',
          uiBaseUrl: 'http://localhost:8093',
        },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const [reactionsReq] = httpMock.match('/api/social/reactions/post/post-1');
    expect(reactionsReq).toBeDefined();
    expect(reactionsReq.request.method).toBe('GET');
    reactionsReq.flush([]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Watch Savannah Signal tonight');
    expect(text).toContain('Watch on MetroCast');

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[data-testid="cross-app-card-link"]'
    );
    expect(link?.getAttribute('href')).toBe(
      'http://localhost:8093/c/savannah-signal'
    );
  });
});
