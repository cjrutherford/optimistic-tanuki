import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
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
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  LocalityRouteContext,
  localityRouteContext,
} from '../../utils/locality-route-context';

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
  private http = inject(HttpClient);
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
  private routeContext: LocalityRouteContext = {
    slug: '',
    baseSegments: [],
  };
  private loadGeneration = 0;

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

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const generation = ++this.loadGeneration;
      this.routeContext = localityRouteContext(params);
      const { slug } = this.routeContext;
      const openForm = this.route.snapshot.data?.['openForm'] === true;
      this.community.set(null);
      this.classifieds.set([]);
      this.error.set(null);
      this.loading.set(true);
      this.isMember.set(false);
      this.showPostForm.set(false);
      this.retryCount = 0;

      if (!slug) {
        this.error.set('Unable to determine the requested locality.');
        this.loading.set(false);
        return;
      }
      this.loadData(slug, generation).then(() => {
        if (
          generation === this.loadGeneration &&
          openForm &&
          this.isAuthenticated() &&
          this.isMember()
        ) {
          this.showPostForm.set(true);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.loadGeneration++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(
    slug: string,
    generation = this.loadGeneration
  ): Promise<void> {
    try {
      const community = await this.communityService.getCommunityBySlug(slug);
      if (generation !== this.loadGeneration) return;
      this.community.set(community);

      try {
        const result = await this.classifiedService.findByCommunity(
          community.id
        );
        if (generation !== this.loadGeneration) return;
        const ads = Array.isArray(result) ? result : result.data;
        const enrichedAds = await this.enrichSellerProfiles(ads);
        if (generation !== this.loadGeneration) return;
        this.classifieds.set(enrichedAds);
      } catch (classifiedErr) {
        if (generation !== this.loadGeneration) return;
        console.warn('Failed to load classifieds:', classifiedErr);
        this.classifieds.set([]);
      }

      if (this.isAuthenticated()) {
        try {
          const member = await this.communityService.isMember(community.id);
          if (generation !== this.loadGeneration) return;
          this.isMember.set(member);
        } catch {
          // non-fatal
        }
      }
      if (generation === this.loadGeneration) this.loading.set(false);
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        console.warn(
          `Retrying load (${this.retryCount}/${this.maxRetries})...`
        );
        await new Promise((r) => setTimeout(r, 1000 * this.retryCount));
        return this.loadData(slug, generation);
      }
      this.error.set('Unable to load classifieds. Please try again later.');
      this.loading.set(false);
    }
  }

  navigateToCommunity(): void {
    if (this.routeContext.baseSegments.length > 0) {
      this.router.navigate(this.routeContext.baseSegments);
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
      const [enrichedCreated] = await this.enrichSellerProfiles([created]);
      this.classifieds.update((ads) => [enrichedCreated || created, ...ads]);
      this.showPostForm.set(false);
      this.messageService.addMessage({
        content: 'Your classified has been posted!',
        type: 'success',
      });
      await this.router.navigate([
        ...this.routeContext.baseSegments,
        'classifieds',
      ]);
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
    if (this.routeContext.baseSegments.length > 0) {
      this.router.navigate([
        ...this.routeContext.baseSegments,
        'classifieds',
        classified.id,
      ]);
    }
  }

  private async enrichSellerProfiles(
    ads: ClassifiedAdDto[]
  ): Promise<ClassifiedAdDto[]> {
    const profileIds = Array.from(
      new Set(ads.map((ad) => ad.profileId).filter(Boolean))
    );
    if (profileIds.length === 0) {
      return ads;
    }

    try {
      const profiles = await firstValueFrom(
        this.http.post<ProfileDto[]>('/api/profile/by-ids', { ids: profileIds })
      );
      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      return ads.map((ad) => {
        const profile = profileMap.get(ad.profileId);
        return {
          ...ad,
          sellerProfileName:
            ad.sellerProfileName || profile?.profileName || null,
          sellerProfilePic: ad.sellerProfilePic || profile?.profilePic || null,
        };
      });
    } catch {
      return ads;
    }
  }
}
