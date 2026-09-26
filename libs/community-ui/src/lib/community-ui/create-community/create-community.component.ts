import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { SpinnerComponent } from '@optimistic-tanuki/common-ui';
import { Variantable, VariantOptions } from '@optimistic-tanuki/common-ui';
import {
  ThemeColors,
  ThemeVariableService,
} from '@optimistic-tanuki/theme-lib';
import {
  TextInputComponent,
  TextAreaComponent,
  SelectComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import { CommunityService } from '../services/community.service';
import { CreateCommunityDto, CommunityJoinPolicy } from '../models';
import { HttpClient } from '@angular/common/http';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { firstValueFrom } from 'rxjs';
import { CreateAssetDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-create-community',
  standalone: true,
  providers: [ThemeVariableService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    SpinnerComponent,
    TextInputComponent,
    TextAreaComponent,
    SelectComponent,
    CheckboxComponent,
  ],
  host: {
    '[class.theme]': 'theme',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
  },
  templateUrl: './create-community.component.html',
  styleUrls: ['./create-community.component.scss'],
})
export class CreateCommunityComponent extends Variantable {
  private readonly communityService = inject(CommunityService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly profiles = inject(ProfileAPIService);

  loading = signal(false);
  uploading = signal(false);
  logoUploading = signal(false);
  bannerUploading = signal(false);
  error = signal<string | null>(null);

  bannerPreview = signal<string | null>(null);
  logoPreview = signal<string | null>(null);
  bannerAssetId = signal<string | null>(null);
  logoAssetId = signal<string | null>(null);

  private uploadPromises: Promise<string>[] = [];
  private logoVersion = 0;
  private bannerVersion = 0;

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

  communityForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(2000)]],
    isPrivate: [false],
    joinPolicy: [CommunityJoinPolicy.PUBLIC],
    tags: [''],
  });

  joinPolicyOptions = [
    { value: CommunityJoinPolicy.PUBLIC, label: 'Public - Anyone can join' },
    {
      value: CommunityJoinPolicy.APPROVAL_REQUIRED,
      label: 'Approval Required - Admins must approve',
    },
    {
      value: CommunityJoinPolicy.INVITE_ONLY,
      label: 'Invite Only - Only invited users can join',
    },
  ];

  applyVariant(colors: ThemeColors, options?: VariantOptions): void {
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

  async onSubmit() {
    if (this.communityForm.invalid) {
      this.error.set('Please fill in all required fields');
      return;
    }
    if (
      this.loading() ||
      this.uploading() ||
      this.logoUploading() ||
      this.bannerUploading()
    ) {
      // Uploads are still in flight; the submit button stays disabled until
      // each pending upload settles. Guards non-button submits (e.g. Enter).
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.uploadPromises.length > 0) {
        this.uploading.set(true);
        try {
          await Promise.all(this.uploadPromises);
        } finally {
          // Clear settled promises on success AND error paths so a retry
          // never re-awaits (or re-fires) an already-settled upload.
          this.uploadPromises = [];
          this.uploading.set(false);
        }
      }

      if (
        (this.logoPreview() && !this.logoAssetId()) ||
        (this.bannerPreview() && !this.bannerAssetId())
      ) {
        this.error.set(
          'An image upload failed. Please re-select the image and try again.'
        );
        return;
      }

      const formValue = this.communityForm.value;
      // Create sends asset IDs only — never file bytes or data URLs.
      const dto: CreateCommunityDto = {
        name: formValue.name,
        description: formValue.description || '',
        isPrivate: formValue.isPrivate || false,
        joinPolicy: formValue.joinPolicy || CommunityJoinPolicy.PUBLIC,
        tags: formValue.tags
          ? formValue.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t)
          : [],
        bannerAssetId: this.bannerAssetId() || undefined,
        logoAssetId: this.logoAssetId() || undefined,
      };

      const community = await this.communityService.create(dto);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ot-community-membership-changed')
        );
      }
      this.router.navigate([
        '/communities/manage',
        community.slug || community.id,
        'members',
      ]);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create community');
      console.error('Error creating community:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async onBannerSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    const version = ++this.bannerVersion;
    this.bannerUploading.set(true);
    this.error.set(null);
    try {
      // Preview-only data URL; file bytes never travel on create.
      const dataUrl = await this.fileToDataUrl(file);
      if (version !== this.bannerVersion) return;
      this.bannerPreview.set(dataUrl);
      this.trackUpload(
        dataUrl,
        file.name,
        (assetId) => this.bannerAssetId.set(assetId),
        'banner',
        () => version === this.bannerVersion,
        (pending) => {
          if (version === this.bannerVersion) {
            this.bannerUploading.set(pending);
          }
        }
      );
    } catch {
      if (version === this.bannerVersion) {
        this.bannerUploading.set(false);
        this.error.set('Failed to read banner file. Please try again.');
      }
    } finally {
      input.value = '';
    }
  }

  async onLogoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    const version = ++this.logoVersion;
    this.logoUploading.set(true);
    this.error.set(null);
    try {
      // Preview-only data URL; file bytes never travel on create.
      const dataUrl = await this.fileToDataUrl(file);
      if (version !== this.logoVersion) return;
      this.logoPreview.set(dataUrl);
      this.trackUpload(
        dataUrl,
        file.name,
        (assetId) => this.logoAssetId.set(assetId),
        'logo',
        () => version === this.logoVersion,
        (pending) => {
          if (version === this.logoVersion) {
            this.logoUploading.set(pending);
          }
        }
      );
    } catch {
      if (version === this.logoVersion) {
        this.logoUploading.set(false);
        this.error.set('Failed to read logo file. Please try again.');
      }
    } finally {
      input.value = '';
    }
  }

  /**
   * Upload once on select. The version guard ensures a remove/clear or a
   * newer selection wins over a late-settling upload.
   */
  private trackUpload(
    dataUrl: string,
    fileName: string,
    setAssetId: (assetId: string) => void,
    slot: 'logo' | 'banner',
    isCurrent: () => boolean,
    setPending: (pending: boolean) => void
  ): void {
    const uploadPromise: Promise<string> = this.uploadImage(
      dataUrl,
      fileName
    ).then(
      (assetId) => {
        if (isCurrent()) setAssetId(assetId);
        return assetId;
      },
      (error) => {
        if (isCurrent()) {
          this.error.set(`Failed to upload ${slot}. Please try again.`);
        }
        throw error;
      }
    );
    // Settle exactly once: drop from the retry set and clear pending state
    // on both success and error paths.
    const tracked = uploadPromise.finally(() => {
      this.uploadPromises = this.uploadPromises.filter(
        (pending) => pending !== uploadPromise
      );
      setPending(false);
    });
    // Avoid unhandled rejections when the user never submits; submit still
    // observes the rejection through `uploadPromises`.
    tracked.catch(() => undefined);
    this.uploadPromises.push(uploadPromise);
  }

  clearLogo(): void {
    this.logoVersion++;
    this.logoPreview.set(null);
    this.logoAssetId.set(null);
    this.logoUploading.set(false);
  }

  clearBanner(): void {
    this.bannerVersion++;
    this.bannerPreview.set(null);
    this.bannerAssetId.set(null);
    this.bannerUploading.set(false);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async uploadImage(
    dataUrl: string,
    fileName: string
  ): Promise<string> {
    const profileId = await this.getCurrentProfileId();
    const fileExtension = this.getFileExtension(fileName);

    const assetDto: CreateAssetDto = {
      name: fileName,
      profileId,
      type: 'image',
      content: dataUrl,
      fileExtension,
    };

    try {
      const asset = await firstValueFrom(
        this.http.post<{ id: string }>('/api/asset', assetDto)
      );
      return asset.id;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  private async getCurrentProfileId(): Promise<string> {
    const profile = await firstValueFrom(
      this.profiles.profileControllerGetCurrentProfile<{ id: string }>()
    );
    return profile.id;
  }

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'png';
  }

  onCancel() {
    this.router.navigate(['/communities']);
  }
}
