import { computed, inject, PLATFORM_ID } from '@angular/core';
import {
  MessageLevelType,
  MessageService,
} from '@optimistic-tanuki/message-ui';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BannerComponent,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import {
  UpdateProfileDto,
  CreateProfileDto,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommunityService } from '../community.service';
import { PostService } from '../post.service';
import { FollowService } from '../follow.service';
import { CommunityDto } from '@optimistic-tanuki/ui-models';
import { PostDto } from '@optimistic-tanuki/social-ui';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardComponent,
    ButtonComponent,
    BannerComponent,
    ProfileEditorComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly messageService = inject(MessageService);
  private readonly profileService = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly postService = inject(PostService);
  private readonly followService = inject(FollowService);
  showProfileEditor = false;
  viewingUserId: string | null = null;
  isViewingOther = false;

  viewingUserProfile = signal<ProfileDto | null>(null);
  userPosts = signal<PostDto[]>([]);
  userCommunities = signal<CommunityDto[]>([]);
  isFollowing = signal(false);
  isBlocked = signal(false);
  followersCount = signal(0);
  followingCount = signal(0);
  ownedCommunities = signal<{ id: string; name: string }[]>([]);
  highlightedPosts = computed(() => this.userPosts().slice(0, 2));
  recentPosts = computed(() => this.userPosts().slice(2, 6));
  featuredCommunities = computed(() =>
    [...this.userCommunities()]
      .sort((left, right) => (right.memberCount ?? 0) - (left.memberCount ?? 0))
      .slice(0, 3)
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      if (isPlatformBrowser(this.platformId)) {
        const profile = localStorage.getItem('selectedProfile');
        if (profile) {
          this.profileService.selectProfile(JSON.parse(profile));
        }
      }
    }
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const userId = params.get('userId');
      const currentProfile = this.profileService.getCurrentUserProfile();

      if (!userId) {
        if (currentProfile?.id) {
          this.router.navigate(['/profile', currentProfile.id], {
            replaceUrl: true,
          });
          return;
        }

        this.viewingUserId = null;
        this.loadSelfProfile();
        return;
      }

      this.viewingUserId = userId;
      this.loadViewingUserProfile(userId);
    });

    this.loadOwnedCommunities();
  }

  private loadSelfProfile() {
    this.isViewingOther = false;
    const currentProfile = this.profileService.getCurrentUserProfile();
    this.viewingUserProfile.set(currentProfile ?? null);

    if (currentProfile?.id) {
      this.viewingUserId = currentProfile.id;
      this.loadUserPosts(currentProfile.id);
      this.loadUserCommunities(currentProfile.id);
      this.loadSocialProof(currentProfile.id);
      this.checkFollowStatus(currentProfile.id);
      this.checkBlockStatus(currentProfile.id, currentProfile.id);
    }

    this.profileService.getAllProfiles().then(() => {
      if (isPlatformBrowser(this.platformId)) {
        const profile = localStorage.getItem('selectedProfile');
        if (profile) {
          this.profileService.selectProfile(JSON.parse(profile));
        }
      }
    });
    if (isPlatformBrowser(this.platformId)) {
      const nav = window?.history?.state;
      if (nav?.showProfileModal) {
        setTimeout(() => {
          window.location.href = '/settings';
          if (nav.profileMessage) {
            this.showMessage(nav.profileMessage, 'warning');
          }
        }, 100);
      }
    }
  }

  private loadViewingUserProfile(userId: string) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    this.isViewingOther = !currentProfile || currentProfile.id !== userId;
    this.viewingUserProfile.set(null);

    this.profileService.getDisplayProfile(userId).subscribe({
      next: (profile) => {
        this.viewingUserProfile.set(profile);
        this.loadUserPosts(userId);
        this.loadUserCommunities(userId);
        this.loadSocialProof(userId);
        this.loadOwnedCommunities();

        if (currentProfile && currentProfile.id !== userId) {
          this.checkFollowStatus(userId);
          this.checkBlockStatus(currentProfile.id, userId);
        } else {
          this.isFollowing.set(false);
          this.isBlocked.set(false);
        }
      },
      error: (err) => {
        console.error('Failed to load user profile', err);
        this.showMessage('Failed to load profile', 'error');
      },
    });
  }

  private loadUserPosts(profileId: string) {
    this.postService
      .searchPosts(
        { profileId },
        { orderBy: 'createdAt', orderDirection: 'desc', limit: 20 }
      )
      .subscribe({
        next: (posts) => {
          this.userPosts.set(posts);
        },
        error: (err) => console.error('Failed to load user posts', err),
      });
  }

  private loadUserCommunities(profileId: string) {
    this.communityService.getUserCommunitiesByProfileId(profileId).subscribe({
      next: (communities) => {
        this.userCommunities.set(communities);
      },
      error: (err) => console.error('Failed to load user communities', err),
    });
  }

  private checkFollowStatus(profileId: string) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) return;

    this.followService.getFollowing(currentProfile.id).subscribe({
      next: (following) => {
        const isFollowing = following.some(
          (f: any) => (f.followeeId || f.id) === profileId
        );
        this.isFollowing.set(isFollowing);
      },
      error: (err) => console.error('Failed to check follow status', err),
    });
  }

  private loadSocialProof(profileId: string) {
    this.followService.getFollowers(profileId).subscribe({
      next: (followers) => {
        this.followersCount.set(
          Array.isArray(followers) ? followers.length : 0
        );
      },
      error: (err) => console.error('Failed to load followers', err),
    });

    this.followService.getFollowing(profileId).subscribe({
      next: (following) => {
        this.followingCount.set(
          Array.isArray(following) ? following.length : 0
        );
      },
      error: (err) => console.error('Failed to load following', err),
    });
  }

  private checkBlockStatus(currentProfileId: string, blockedProfileId: string) {
    this.profileService.getBlockedUsers(currentProfileId).subscribe({
      next: (blocked) => {
        const isBlocked = blocked.some(
          (b: any) => b.blockedProfileId === blockedProfileId
        );
        this.isBlocked.set(isBlocked);
      },
      error: (err) => console.error('Failed to check block status', err),
    });
  }

  private loadOwnedCommunities() {
    this.communityService.getUserCommunities().subscribe({
      next: (communities) => {
        const currentProfile = this.profileService.getCurrentUserProfile();
        if (!currentProfile) return;

        const currentUserIds = new Set(
          [currentProfile.id, currentProfile.userId].filter(Boolean) as string[]
        );
        const owned = communities
          .filter((c: CommunityDto) =>
            [c.ownerId, c.ownerProfileId, ...(c.ownerIds ?? [])].some(
              (ownerId) => ownerId && currentUserIds.has(ownerId)
            )
          )
          .map((c: CommunityDto) => ({ id: c.id, name: c.name }));
        this.ownedCommunities.set(owned);
      },
      error: (err) => console.error('Failed to load owned communities', err),
    });
  }

  showMessage(msg: string, type: MessageLevelType = 'info') {
    this.messageService.addMessage({ content: msg, type });
  }

  onBannerClick() {
    if (!this.isViewingOther) {
      this.showProfileEditor = true;
    }
  }

  openProfileEditor() {
    if (!this.isViewingOther) {
      this.showProfileEditor = true;
    }
  }

  onProfileEditorClose() {
    this.showProfileEditor = false;
  }

  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id;
    this.profileService
      .updateProfile(id, { ...profile, bio: profile.bio ? profile.bio : '' })
      .then(() => {
        this.viewingUserProfile.set(
          this.profileService.getCurrentUserProfile() ?? null
        );
        this.showMessage('Profile updated and selected!', 'success');
        this.showProfileEditor = false;
      });
  }

  selectProfile(profile: ProfileDto) {
    this.profileService.selectProfile(profile);
    this.showMessage('Profile selected!', 'success');
    setTimeout(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/feed']);
      }
    }, 500);
  }

  createProfile(newProfile: CreateProfileDto) {
    this.profileService.createProfile(newProfile).then(() => {
      this.profileService.getAllProfiles().then(() => {
        this.showMessage('Profile created and selected!', 'success');
        this.showProfileEditor = false;
      });
    });
  }

  goToSettings() {
    if (isPlatformBrowser(this.platformId)) {
      this.router.navigate(['/settings']);
    }
  }

  onFollowToggle() {
    const currentProfile = this.profileService.getCurrentUserProfile();
    const viewingProfile = this.viewingUserProfile();
    if (!currentProfile || !viewingProfile) return;

    if (this.isFollowing()) {
      this.followService
        .unfollow({
          followerId: currentProfile.id,
          followeeId: viewingProfile.id,
        })
        .subscribe({
          next: () => {
            this.isFollowing.set(false);
            this.followersCount.update((count) => Math.max(0, count - 1));
            this.showMessage('Unfollowed user', 'success');
          },
          error: (err) => console.error('Failed to unfollow', err),
        });
    } else {
      this.followService
        .follow({
          followerId: currentProfile.id,
          followeeId: viewingProfile.id,
        })
        .subscribe({
          next: () => {
            this.isFollowing.set(true);
            this.followersCount.update((count) => count + 1);
            this.showMessage('Following user', 'success');
          },
          error: (err) => console.error('Failed to follow', err),
        });
    }
  }

  onBlockToggle() {
    const currentProfile = this.profileService.getCurrentUserProfile();
    const viewingProfile = this.viewingUserProfile();
    if (!currentProfile || !viewingProfile) return;

    if (this.isBlocked()) {
      this.profileService
        .unblockUser(currentProfile.id, viewingProfile.id)
        .subscribe({
          next: () => {
            this.isBlocked.set(false);
            this.showMessage('User unblocked', 'success');
          },
          error: (err) => console.error('Failed to unblock', err),
        });
    } else {
      this.profileService
        .blockUser(currentProfile.id, viewingProfile.id)
        .subscribe({
          next: () => {
            this.isBlocked.set(true);
            this.showMessage('User blocked', 'success');
          },
          error: (err) => console.error('Failed to block', err),
        });
    }
  }

  onMessage() {
    const viewingProfile = this.viewingUserProfile();
    if (viewingProfile) {
      this.router.navigate(['/messages'], {
        queryParams: { userId: viewingProfile.id },
      });
    }
  }

  onInviteToCommunity(communityId: string) {
    const viewingProfile = this.viewingUserProfile();
    if (!viewingProfile) return;

    const community = this.ownedCommunities().find((c) => c.id === communityId);
    if (!community) return;

    this.communityService.inviteUser(communityId, viewingProfile.id).subscribe({
      next: () => {
        this.showMessage(`Invited to ${community.name}`, 'success');
      },
      error: (err) => console.error('Failed to invite', err),
    });
  }

  getProfileTags(value: string | null | undefined): string[] {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  getProfileCompletionPrompts(
    profile: ProfileDto | null | undefined
  ): string[] {
    if (!profile || this.isViewingOther) {
      return [];
    }

    const prompts: string[] = [];

    if (!profile.bio?.trim()) {
      prompts.push('Add a short bio so visitors know what you are about.');
    }
    if (!profile.occupation?.trim()) {
      prompts.push('Share your expertise or current role.');
    }
    if (!profile.location?.trim()) {
      prompts.push('Add your location to make local connections easier.');
    }
    if (this.getProfileTags(profile.skills).length === 0) {
      prompts.push('List a few skills to show what you can help with.');
    }
    if (this.getProfileTags(profile.interests).length === 0) {
      prompts.push(
        'Add interests so communities and followers know what you enjoy.'
      );
    }
    if (!profile.profilePic?.trim()) {
      prompts.push('Upload a profile photo to make the page feel complete.');
    }

    return prompts;
  }

  getProfileCompletionScore(profile: ProfileDto | null | undefined): number {
    if (!profile) {
      return 0;
    }

    const checks = [
      profile.profileName?.trim(),
      profile.bio?.trim(),
      profile.occupation?.trim(),
      profile.location?.trim(),
      this.getProfileTags(profile.skills).length > 0 ? 'skills' : '',
      this.getProfileTags(profile.interests).length > 0 ? 'interests' : '',
      profile.profilePic?.trim(),
    ];
    const completed = checks.filter(Boolean).length;

    return Math.round((completed / checks.length) * 100);
  }

  get profile() {
    if (this.isViewingOther) {
      return this.viewingUserProfile();
    }
    return this.profileService.getCurrentUserProfile();
  }
}
