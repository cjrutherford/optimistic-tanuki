import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  community = signal<LocalCommunity | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isMember = signal(false);
  isAuthenticated = signal(false);
  joiningInProgress = signal(false);

  Math = Math;

  getMarkerPosition(): { x: number; y: number } {
    const community = this.community();
    if (!community) return { x: 100, y: 60 };

    const lat = community.coordinates?.lat || community.lat || 0;
    const lng = community.coordinates?.lng || community.lng || 0;

    const x = ((lng + 180) / 360) * 200;
    const y = ((90 - lat) / 180) * 120;

    return { x, y };
  }

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
      const communities = await this.communityService.getMockCommunities();
      const data = communities.find((c) => c.slug === slug);

      if (!data) {
        this.error.set(
          'Community not found or unable to load. Please try again.'
        );
      } else {
        this.community.set(data);

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
}
