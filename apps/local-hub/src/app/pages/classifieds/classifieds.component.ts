import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommunityService, LocalCommunity } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  ClassifiedListComponent,
  ClassifiedFormComponent,
  ClassifiedService,
  ClassifiedAdDto,
  CreateClassifiedAdDto,
  UpdateClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';

@Component({
  selector: 'app-classifieds',
  standalone: true,
  imports: [CommonModule, ClassifiedListComponent, ClassifiedFormComponent],
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
  classifieds = signal<ClassifiedAdDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);
  showPostForm = signal(false);

  ngOnInit(): void {
    this.authState.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe((auth) => {
      this.isAuthenticated.set(auth);
    });

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    const openForm = this.route.snapshot.data?.['openForm'] === true;
    this.loadData(slug).then(() => {
      if (openForm && this.isAuthenticated() && this.isMember()) {
        this.showPostForm.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(slug: string): Promise<void> {
    try {
      const community = await this.communityService.getCommunityBySlug(slug);
      this.community.set(community);

      const classifieds = await this.classifiedService.findByCommunity(community.id);
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

  onPostNew(): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('post-classified');
      return;
    }
    if (!this.isMember()) {
      this.messageService.addMessage({
        content: 'Please join this community first to post a classified.',
        type: 'info',
      });
      return;
    }
    this.showPostForm.set(true);
  }

  async onFormSubmit(dto: CreateClassifiedAdDto | UpdateClassifiedAdDto): Promise<void> {
    try {
      const created = await this.classifiedService.create(dto as CreateClassifiedAdDto);
      this.classifieds.update((ads) => [created, ...ads]);
      this.showPostForm.set(false);
      this.messageService.addMessage({
        content: 'Your classified has been posted!',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to post classified. Please try again.',
        type: 'error',
      });
    }
  }

  onContactSeller(classified: ClassifiedAdDto): void {
    if (!this.isAuthenticated()) {
      this.promptSignIn('contact-seller');
      return;
    }
    if (!this.isMember()) {
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

