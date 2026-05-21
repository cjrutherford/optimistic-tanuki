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
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-variant]': 'variant',
  },
  templateUrl: './create-community.component.html',
  styleUrls: ['./create-community.component.scss'],
})
export class CreateCommunityComponent extends Variantable {
  private readonly communityService = inject(CommunityService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  loading = signal(false);
  uploading = signal(false);
  error = signal<string | null>(null);

  bannerPreview = signal<string | null>(null);
  logoPreview = signal<string | null>(null);
  bannerAssetId = signal<string | null>(null);
  logoAssetId = signal<string | null>(null);

  private uploadPromises: Promise<string>[] = [];

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

    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.uploadPromises.length > 0) {
        this.uploading.set(true);
        await Promise.all(this.uploadPromises);
        this.uploading.set(false);
      }

      const formValue = this.communityForm.value;
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
        window.dispatchEvent(new CustomEvent('ot-community-membership-changed'));
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
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const dataUrl = await this.fileToDataUrl(file);
      this.bannerPreview.set(dataUrl);

      const uploadPromise = this.uploadImage(dataUrl, file.name).then(
        (assetId) => {
          this.bannerAssetId.set(assetId);
          return assetId;
        }
      );
      this.uploadPromises.push(uploadPromise);
    }
  }

  async onLogoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const dataUrl = await this.fileToDataUrl(file);
      this.logoPreview.set(dataUrl);

      const uploadPromise = this.uploadImage(dataUrl, file.name).then(
        (assetId) => {
          this.logoAssetId.set(assetId);
          return assetId;
        }
      );
      this.uploadPromises.push(uploadPromise);
    }
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
      this.http.get<{ id: string }>('/api/profile/me')
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
