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
import { AssetService } from '../../services/asset.service';
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
  private assetService = inject(AssetService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  community = signal<LocalCommunity | null>(null);
  classifieds = signal<ClassifiedAdDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  isAuthenticated = signal(false);
  isMember = signal(false);
  showPostForm = signal(false);
  retryCount = 0;
  readonly maxRetries = 3;

  /** Image upload callback passed to ClassifiedFormComponent */
  uploadImage = async (file: File): Promise<string> => {
    const profileId = this.authState.getActingProfileId();
    const dataUrl = await this.assetService.fileToDataUrl(file);
    const asset = await this.assetService.createAsset({
      name: file.name,
      profileId,
      type: 'image',
      content: dataUrl,
      fileExtension: this.assetService.getFileExtension(dataUrl),
    });
    return this.assetService.getAssetUrl(asset.id);
  };

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => {
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

      try {
        const result = await this.classifiedService.findByCommunity(
          community.id
        );
        const ads = Array.isArray(result) ? result : result.data;
        this.classifieds.set(ads);
      } catch (classifiedErr) {
        console.warn('Failed to load classifieds:', classifiedErr);
        this.classifieds.set([]);
      }

      if (this.isAuthenticated()) {
        try {
          const member = await this.communityService.isMember(community.id);
          this.isMember.set(member);
        } catch {
          // non-fatal
        }
      }
    } catch (err) {
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        console.warn(
          `Retrying load (${this.retryCount}/${this.maxRetries})...`
        );
        await new Promise((r) => setTimeout(r, 1000 * this.retryCount));
        return this.loadData(slug);
      }
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

  async onFormSubmit(
    dto: CreateClassifiedAdDto | UpdateClassifiedAdDto
  ): Promise<void> {
    try {
      const created = await this.classifiedService.create(
        dto as CreateClassifiedAdDto
      );
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
    // Navigate to the detail page — chat happens there
    this.onViewAd(classified);
  }

  onViewAd(classified: ClassifiedAdDto): void {
    const slug = this.community()?.slug;
    if (slug) {
      this.router.navigate(['/c', slug, 'classifieds', classified.id]);
    }
  }
}
