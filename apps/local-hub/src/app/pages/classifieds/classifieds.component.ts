import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ClassifiedService, ClassifiedAd } from '../../services/classified.service';
import { CommunityService, LocalCommunity } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-classifieds',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './classifieds.component.html',
  styleUrls: ['./classifieds.component.scss'],
})
export class ClassifiedsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classifiedService = inject(ClassifiedService);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  community = signal<LocalCommunity | null>(null);
  classifieds = signal<ClassifiedAd[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);

  ngOnInit(): void {
    this.authState.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe((auth) => {
      this.isAuthenticated.set(auth);
    });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loadData(slug);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(slug: string): Promise<void> {
    try {
      const [community, classifieds] = await Promise.all([
        this.communityService.getCommunityBySlug(slug),
        this.classifiedService.getClassifieds(slug),
      ]);
      this.community.set(community);
      this.classifieds.set(classifieds);

      if (this.isAuthenticated()) {
        try {
          const member = await this.communityService.isMember(community.id);
          this.isMember.set(member);
        } catch {
          // non-fatal
        }
      }
    } catch {
      this.error.set('Unable to load classifieds. Please try again later.');
    } finally {
      this.loading.set(false);
    }
  }

  navigateToCommunity(): void {
    const slug = this.community()?.slug;
    if (slug) {
      this.router.navigate(['/c', slug]);
    }
  }

  promptSignIn(action: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, action },
    });
  }

  promptPostClassified(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('post-classified');
      return;
    }
    if (!this.isMember()) {
      // TODO: show join-community modal (Phase 2)
      this.messageService.addMessage({
        content: 'Please join this community first to post a classified.',
        type: 'info',
      });
      return;
    }
    // TODO: navigate to create classified form (Phase 3)
    this.messageService.addMessage({
      content: 'Create classified listings coming in Phase 3!',
      type: 'info',
    });
  }

  promptContactSeller(classified: ClassifiedAd): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('contact-seller');
      return;
    }
    if (!this.isMember()) {
      // TODO: show join-community modal (Phase 2)
      this.messageService.addMessage({
        content: 'Please join this community first to contact sellers.',
        type: 'info',
      });
      return;
    }
    // TODO: open buyer/seller chat (Phase 3)
    this.messageService.addMessage({
      content: `Buyer/seller messaging for "${classified.title}" coming in Phase 3!`,
      type: 'info',
    });
  }
}
