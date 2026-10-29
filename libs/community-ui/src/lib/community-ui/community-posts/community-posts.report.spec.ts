import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  OptomisitcTanukiAPIService as SocialAPIService,
  PrivacyReportService,
} from '@optimistic-tanuki/social-data-access';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  PostComponent,
  ReportDialogComponent,
} from '@optimistic-tanuki/social-ui';
import { CommunityPostsComponent } from './community-posts.component';
import { CommunityService } from '../services/community.service';

describe('CommunityPostsComponent report integration', () => {
  let fixture: ComponentFixture<CommunityPostsComponent>;
  const postFixture = {
    id: 'community-post-1',
    profileId: 'selected-profile-1',
    userId: 'account-1',
    title: 'A post',
    content: 'Body',
    createdAt: new Date().toISOString(),
  } as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommunityPostsComponent,
        RouterTestingModule,
        HttpClientTestingModule,
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'community-slug' } } },
        },
        {
          provide: CommunityService,
          useValue: {
            getCurrentUserProfile: async () => ({
              id: 'selected-profile-1',
              userId: 'account-1',
              profileName: 'Selected profile',
              profilePic: '',
            }),
            findBySlug: async () => ({
              id: 'community-1',
              name: 'Community',
              ownerId: 'account-owner',
              ownerProfileId: 'profile-owner',
              ownerIds: [],
            }),
            getCommunityPosts: async () => [postFixture],
            getProfilesByIds: async () => [
              {
                id: 'selected-profile-1',
                profileName: 'Selected profile',
                profilePic: '',
              },
            ],
          },
        },
        {
          provide: SocialAPIService,
          useValue: {
            socialControllerGetReactionsByPost: () => of([]),
            socialControllerGetUserReaction: () => of(null),
            socialControllerFindVotes: () => of([]),
          },
        },
        {
          provide: PrivacyReportService,
          useValue: { reportContent: () => of({ id: 'report-1' }) },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityPostsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('uses selected profile identity and opens the shared dialog for the post id', () => {
    const postElement = fixture.debugElement.query(By.directive(PostComponent));
    if (!postElement) throw new Error(fixture.nativeElement.textContent);
    const post = postElement.componentInstance as PostComponent;
    expect(post.currentUserId).toBe('selected-profile-1');
    expect(post.canEdit()).toBe(true);

    post.openReport();
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(
      By.directive(ReportDialogComponent)
    ).componentInstance as ReportDialogComponent;
    expect(dialog.contentType).toBe('post');
    expect(dialog.contentId).toBe('community-post-1');
  });
});
