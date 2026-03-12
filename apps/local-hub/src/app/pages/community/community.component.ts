import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService, LocalCommunity } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);

  community = signal<LocalCommunity | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isMember = signal(false);
  isAuthenticated = signal(false);
  joiningInProgress = signal(false);

  ngOnInit(): void {
    this.authState.isAuthenticated$.subscribe((auth) => {
      this.isAuthenticated.set(auth);
    });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loadCommunity(slug);
  }

  async loadCommunity(slug: string): Promise<void> {
    try {
      const data = await this.communityService.getCommunityBySlug(slug);
      this.community.set(data);

      if (this.isAuthenticated()) {
        try {
          const member = await this.communityService.isMember(data.id);
          this.isMember.set(member);
        } catch {
          // membership check failing is non-fatal
        }
      }
    } catch {
      this.error.set('Community not found or unable to load. Please try again.');
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

  promptSignIn(action: string): void {
    // Placeholder: redirect to login with a return URL
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
    } catch {
      // TODO: show error toast
    } finally {
      this.joiningInProgress.set(false);
    }
  }
}
