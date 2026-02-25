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
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';

@Component({
  selector: 'lib-community-posts',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [CommonModule, ComposeComponent, PostComponent],
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

  community = signal<CommunityDto | null>(null);
  posts = signal<PostDto[]>([]);
  profiles = signal<{ [key: string]: PostProfileStub }>({});
  loading = signal(true);
  error = signal<string | null>(null);
  activeTab = signal<'posts' | 'create'>('posts');

  setActiveTab(tab: 'posts' | 'create') {
    this.activeTab.set(tab);
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

    this.route.data.subscribe((data: any) => {
      this.currentUserId = data['currentUserId'] || '';
      this.loadCurrentProfile();
    });

    const communityId = this.route.snapshot.paramMap.get('communityId');
    if (!communityId) {
      this.error.set('Community ID not found');
      this.loading.set(false);
      return;
    }

    this.loadCommunity(communityId);
    this.loadPosts(communityId);
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
    } catch (err) {
      console.error('Error loading posts:', err);
      this.error.set('Failed to load posts');
    } finally {
      this.loading.set(false);
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
}
