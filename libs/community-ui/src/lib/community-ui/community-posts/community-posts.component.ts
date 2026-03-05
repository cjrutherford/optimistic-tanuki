import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import {
  ComposeComponent,
  PostComponent,
  PostData,
  PostDto,
  PostProfileStub,
} from '@optimistic-tanuki/social-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'lib-community-posts',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [CommonModule, ComposeComponent, PostComponent, ButtonComponent],
  host: {
    '[class.theme]': 'theme',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-variant]': 'variant',
  },
  templateUrl: './community-posts.component.html',
  styleUrls: ['./community-posts.component.scss'],
})
export class CommunityPostsComponent extends Variantable {
  private readonly communityService = inject(CommunityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  community = signal<CommunityDto | null>(null);
  posts = signal<PostDto[]>([]);
  profiles = signal<{ [key: string]: PostProfileStub }>({});
  loading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<'posts' | 'create' | 'manage'>('posts');
  isOwnerOrManager = signal(false);

  userVotes = signal<{ [postId: string]: number }>({});
  voteCounts = signal<{ [postId: string]: number }>({});
  userReactions = signal<{ [postId: string]: number }>({});
  reactionCounts = signal<{ [postId: string]: { [value: number]: number } }>(
    {}
  );

  setActiveTab(tab: 'posts' | 'create' | 'manage') {
    this.activeTab.set(tab);
  }

  goToManage() {
    const communityId = this.route.snapshot.paramMap.get('communityId');
    if (communityId) {
      this.router.navigate(['/communities/manage', communityId, 'members']);
    }
  }

  goToChat() {
    const communityId = this.route.snapshot.paramMap.get('communityId');
    if (communityId) {
      this.router.navigate(['/communities', communityId, 'chat']);
    }
  }

  onStartChat(profileId: string) {
    if (profileId === this.currentProfileId) {
      return;
    }
    this.router.navigate(['/chat/dm', profileId]);
  }

  currentUserId = '';
  currentProfileId = '';
  currentProfileName = '';
  currentProfileAvatar = '';

  variant!: string;
  backgroundFilter!: string;
  borderWidth!: string;
  borderRadius!: string;
  borderStyle!: string;
  backgroundGradient!: string;
  svgPattern!: string;
  glowFilter!: string;
  gradientType!: string;
  gradientStops!: string;
  gradientColors!: string;
  animation!: string;
  hoverBoxShadow!: string;
  hoverGradient!: string;
  hoverGlowFilter!: string;
  insetShadow!: string;
  bodyGradient!: string;
  backgroundPattern!: string;

  override applyVariant(colors: ThemeColors, options?: VariantOptions): void {
    this.variant = options?.variant || 'default';
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.borderGradient =
      this.theme === 'dark'
        ? colors.complementaryGradients?.['dark']
        : colors.complementaryGradients?.['light'];
  }

  override ngOnInit(): void {
    super.ngOnInit();

    const communityId = this.route.snapshot.paramMap.get('communityId');
    if (!communityId) {
      this.error.set('Community ID not found');
      this.loading.set(false);
      return;
    }

    this.loadCurrentProfile().then(() => {
      this.loadCommunity(communityId);
      this.loadPosts(communityId);
    });
  }

  override ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadCurrentProfile() {
    try {
      const profile = await this.communityService.getCurrentUserProfile();
      this.currentProfileId = profile.id;
      this.currentProfileName = profile.profileName;
      this.currentProfileAvatar = profile.profilePic;
    } catch (err) {
      console.error('Error loading current profile:', err);
    }
  }

  private async loadCommunity(id: string) {
    try {
      const community = await this.communityService.findOne(id);
      if (community) {
        const bannerUrl = community.bannerAssetId
          ? `/api/asset/${community.bannerAssetId}`
          : community.bannerUrl;
        const logoUrl = community.logoAssetId
          ? `/api/asset/${community.logoAssetId}`
          : community.logoUrl;
        const communityWithUrls = {
          ...community,
          bannerUrl,
          logoUrl,
        };
        this.community.set(communityWithUrls);

        const isOwner = community.ownerId === this.currentProfileId;

        if (!isOwner && this.currentProfileId) {
          const isAdminOrMod = community.ownerIds?.includes(
            this.currentProfileId
          );
          if (isAdminOrMod) {
            this.isOwnerOrManager.set(true);
          }
        } else if (isOwner) {
          this.isOwnerOrManager.set(true);
        }
      }
    } catch (err) {
      console.error('Error loading community:', err);
      this.error.set('Failed to load community');
    }
  }

  private async loadPosts(communityId: string) {
    try {
      const posts = await this.communityService.getCommunityPosts(communityId);
      this.posts.set(posts);
      await this.loadProfiles(posts);
      await this.loadReactionData(posts);
    } catch (err) {
      console.error('Error loading posts:', err);
      this.error.set('Failed to load posts');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadReactionData(posts: PostDto[]) {
    for (const post of posts) {
      try {
        const reactions = await firstValueFrom(
          this.http.get<any[]>(`/api/social/reactions/post/${post.id}`)
        );
        this.reactionCounts.update((counts) => ({
          ...counts,
          [post.id]: reactions.reduce(
            (acc: { [value: number]: number }, r: any) => {
              acc[r.value] = (acc[r.value] || 0) + 1;
              return acc;
            },
            {}
          ),
        }));
      } catch (err) {
        console.error('Error loading reactions for post:', post.id, err);
      }

      if (this.currentProfileId) {
        try {
          const userReaction = await firstValueFrom(
            this.http.get<any>(`/api/social/reaction/post/${post.id}/user`)
          );
          if (userReaction) {
            this.userReactions.update((reactions) => ({
              ...reactions,
              [post.id]: userReaction.value,
            }));
          }
        } catch (err) {
          console.error('Error loading user reaction for post:', post.id, err);
        }

        try {
          const votes = await firstValueFrom(
            this.http.get<any[]>(`/api/social/vote/${post.id}`)
          );
          this.voteCounts.update((counts) => ({
            ...counts,
            [post.id]: votes.length,
          }));

          const userVote = votes.find(
            (v: any) => v.profileId === this.currentProfileId
          );
          if (userVote) {
            this.userVotes.update((votes) => ({
              ...votes,
              [post.id]: userVote.value,
            }));
          }
        } catch (err) {
          console.error('Error loading votes for post:', post.id, err);
        }
      }
    }
  }

  private async loadProfiles(posts: PostDto[]) {
    const profileIds = [...new Set(posts.map((p) => p.profileId))];
    if (profileIds.length === 0) return;

    try {
      const profiles = await this.communityService.getProfilesByIds(profileIds);
      const profileMap: { [key: string]: PostProfileStub } = {};
      profiles.forEach((profile: any) => {
        profileMap[profile.id] = {
          id: profile.id,
          name: profile.profileName,
          avatar: profile.profilePic,
        };
      });
      this.profiles.set(profileMap);
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }

  async createdPost(postData: PostData) {
    const { title, content, attachments } = postData;
    const community = this.community();

    if (!this.currentProfileId) {
      this.error.set('No profile found');
      return;
    }

    if (!community) {
      this.error.set('No community found');
      return;
    }

    const attachmentIds = attachments?.map((a: any) => a.id || a.assetId);

    try {
      const newPost = await this.communityService.createPost({
        title,
        content,
        profileId: this.currentProfileId,
        communityId: community.id,
        attachmentIds,
      });

      const postWithProfile: PostDto = {
        ...newPost,
        profileId: this.currentProfileId,
        userId: this.currentUserId,
        createdAt: new Date(),
      };

      const updatedPosts = [postWithProfile, ...this.posts()];
      this.posts.set(updatedPosts);

      this.profiles.update((p) => ({
        ...p,
        [this.currentProfileId]: {
          id: this.currentProfileId,
          name: this.currentProfileName,
          avatar: this.currentProfileAvatar,
        },
      }));

      this.activeTab.set('posts');
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create post');
      console.error('Error creating post:', err);
    }
  }

  onVoteChanged(event: { postId: string; value: number }) {
    if (!this.currentProfileId) {
      console.error('No profile found for voting');
      return;
    }

    firstValueFrom(
      this.http.post(`/api/social/vote`, {
        postId: event.postId,
        value: event.value,
        profileId: this.currentProfileId,
      })
    )
      .then(() => {
        this.userVotes.update((votes) => ({
          ...votes,
          [event.postId]: event.value,
        }));
        this.voteCounts.update((counts) => {
          const currentCount = counts[event.postId] || 0;
          const currentVote = this.userVotes()[event.postId] || 0;
          let newCount = currentCount;
          if (currentVote === 0 && event.value !== 0) {
            newCount = currentCount + 1;
          } else if (currentVote !== 0 && event.value === 0) {
            newCount = Math.max(0, currentCount - 1);
          }
          return { ...counts, [event.postId]: newCount };
        });
      })
      .catch((err) => console.error('Error voting:', err));
  }

  onReactionChanged(event: { postId: string; value: number }) {
    if (!this.currentProfileId) {
      console.error('No profile found for reacting');
      return;
    }

    firstValueFrom(
      this.http.post(`/api/social/reaction`, {
        postId: event.postId,
        value: event.value,
        profileId: this.currentProfileId,
      })
    )
      .then(() => {
        const currentReaction = this.userReactions()[event.postId] || 0;
        const newReaction = currentReaction === event.value ? 0 : event.value;

        this.userReactions.update((reactions) => ({
          ...reactions,
          [event.postId]: newReaction,
        }));

        this.reactionCounts.update((counts) => {
          const postCounts = counts[event.postId] || {};
          const currentCount = postCounts[event.value] || 0;
          let newCounts = { ...postCounts };

          if (currentReaction === event.value) {
            newCounts[event.value] = Math.max(0, currentCount - 1);
          } else {
            if (currentReaction > 0) {
              newCounts[currentReaction] = Math.max(
                0,
                (postCounts[currentReaction] || 1) - 1
              );
            }
            newCounts[event.value] = currentCount + 1;
          }

          return { ...counts, [event.postId]: newCounts };
        });
      })
      .catch((err) => console.error('Error reacting:', err));
  }

  getUserVote(postId: string): number {
    return this.userVotes()[postId] || 0;
  }

  getVoteCount(postId: string): number {
    return this.voteCounts()[postId] || 0;
  }

  getUserReaction(postId: string): number {
    return this.userReactions()[postId] || 0;
  }

  getReactionCounts(postId: string): { [value: number]: number } {
    return this.reactionCounts()[postId] || {};
  }
}
