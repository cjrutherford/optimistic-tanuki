import { inject, PLATFORM_ID } from '@angular/core';
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
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly postService = inject(PostService);
  private readonly followService = inject(FollowService);

  profileService: ProfileService;
  showProfileEditor = false;
  viewingUserId: string | null = null;
  isViewingOther = false;

  viewingUserProfile = signal<ProfileDto | null>(null);
  userPosts = signal<PostDto[]>([]);
  userCommunities = signal<CommunityDto[]>([]);
  isFollowing = signal(false);
  isBlocked = signal(false);
  ownedCommunities = signal<{ id: string; name: string }[]>([]);

  constructor(readonly _profileService: ProfileService) {
   if(isPlatformBrowser(this.platformId)) {
    this.profileService = _profileService;
    const profile = localStorage.getItem('selectedProfile');
    if (profile) {
      this.profileService.selectProfile(JSON.parse(profile));
    }
  }
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const userId = params.get('userId');
      if (userId) {
        this.viewingUserId = userId;
        this.loadViewingUserProfile(userId);
      } else {
        this.viewingUserId = null;
        this.loadSelfProfile();
      }
    });

    this.loadOwnedCommunities();
  }

  private loadSelfProfile() {
    this.isViewingOther = false;
    this.viewingUserProfile.set(null);
    this.profileService.getAllProfiles().then(() => {
      const profile = localStorage.getItem('selectedProfile');
      if (profile) {
        this.profileService.selectProfile(JSON.parse(profile));
      }
    });
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

  private loadViewingUserProfile(userId: string) {
    this.isViewingOther = true;
    const currentProfile = this.profileService.getCurrentUserProfile();

    if (currentProfile && currentProfile.id === userId) {
      this.isViewingOther = false;
      this.loadSelfProfile();
      return;
    }

    this.profileService.getDisplayProfile(userId).subscribe({
      next: (profile) => {
        this.viewingUserProfile.set(profile);
        this.loadUserPosts(userId);
        this.loadUserCommunities(userId);
        this.checkFollowStatus(userId);
        this.checkBlockStatus(currentProfile?.id || '', userId);
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

        const owned = communities
          .filter((c: CommunityDto) => c.ownerId === currentProfile.userId)
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

  onProfileEditorClose() {
    this.showProfileEditor = false;
  }

  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id;
    this.profileService
      .updateProfile(id, { ...profile, bio: profile.bio ? profile.bio : '' })
      .then(() => {
        this.profileService.getProfileById(id);
        this.showMessage('Profile updated and selected!', 'success');
        this.showProfileEditor = false;
      });
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
    window.location.href = '/settings';
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

  get profile() {
    if (this.isViewingOther) {
      return this.viewingUserProfile();
    }
    return this.profileService.getCurrentUserProfile();
  }
}
