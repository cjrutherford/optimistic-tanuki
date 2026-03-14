import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  LocalCommunity,
  CityPost,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { MapComponent } from '../../components/map/map.component';
import { ComposeComponent, PostData } from '@optimistic-tanuki/social-ui';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, DatePipe, MapComponent, ComposeComponent],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  readonly authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  community = signal<LocalCommunity | null>(null);
  posts = signal<CityPost[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isMember = signal(false);
  isAuthenticated = signal(false);
  joiningInProgress = signal(false);
  showCompose = signal(false);
  submittingPost = signal(false);

  async ngOnInit(): Promise<void> {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => {
        this.isAuthenticated.set(auth);
      });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    await this.loadCommunity(slug);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadCommunity(slug: string): Promise<void> {
    try {
      const data = await this.communityService.getCommunityBySlug(slug);

      if (!data) {
        this.error.set(
          'Community not found or unable to load. Please try again.'
        );
      } else {
        this.community.set(data);

        // Load posts for this community
        const communityPosts = await this.communityService.getPostsForCommunity(slug);
        this.posts.set(communityPosts);

        if (this.isAuthenticated()) {
          try {
            const member = await this.communityService.isMember(data.id);
            this.isMember.set(member);
          } catch {
            // membership check failing is non-fatal
          }
        }
      }
    } catch {
      this.error.set(
        'Community not found or unable to load. Please try again.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  navigateToClassifieds(): void {
    const slug = this.community()?.slug;
    if (slug) {
      this.router.navigate(['/c', slug, 'classifieds']);
    }
  }

  navigateToCity(): void {
    const community = this.community();
    if (community) {
      const citySlug = community.city.toLowerCase().replace(/\s+/g, '-');
      this.router.navigate(['/city', citySlug]);
    }
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }

  promptSignIn(action: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, action },
    });
  }

  promptJoin(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('join');
      return;
    }
    const community = this.community();
    if (!community) return;
    this.joinCommunity(community.id);
  }

  async joinCommunity(communityId: string): Promise<void> {
    this.joiningInProgress.set(true);
    try {
      await this.communityService.joinCommunity(communityId);
      this.isMember.set(true);
      this.messageService.addMessage({
        content: 'You have joined the community!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to join the community. Please try again.',
        type: 'error',
      });
    } finally {
      this.joiningInProgress.set(false);
    }
  }

  async leaveCommunity(): Promise<void> {
    const community = this.community();
    if (!community) return;
    this.joiningInProgress.set(true);
    try {
      await this.communityService.leaveCommunity(community.id);
      this.isMember.set(false);
      this.messageService.addMessage({
        content: 'You have left the community.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to leave the community. Please try again.',
        type: 'error',
      });
    } finally {
      this.joiningInProgress.set(false);
    }
  }

  navigateToNewClassified(): void {
    const community = this.community();
    if (community) {
      this.router.navigate(['/c', community.slug, 'classifieds', 'new']);
    }
  }

  toggleCompose(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('compose');
      return;
    }
    this.showCompose.update((v) => !v);
  }

  async onPostSubmitted(data: PostData): Promise<void> {
    const community = this.community();
    if (!community) return;

    const profileId = this.authState.getActingProfileId();
    if (!profileId) {
      this.messageService.addMessage({
        content: 'Unable to determine your profile. Please sign in again.',
        type: 'error',
      });
      return;
    }

    this.submittingPost.set(true);
    try {
      const newPost = await this.communityService.createPost(
        community.id,
        community.slug,
        community.name,
        { title: data.title, content: data.content, profileId }
      );
      this.posts.update((current) => [newPost, ...current]);
      this.showCompose.set(false);
      this.messageService.addMessage({
        content: 'Your post has been published!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to publish post. Please try again.',
        type: 'error',
      });
    } finally {
      this.submittingPost.set(false);
    }
  }
}
