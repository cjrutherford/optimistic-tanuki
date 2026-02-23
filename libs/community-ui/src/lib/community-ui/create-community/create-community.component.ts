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

  loading = signal(false);
  error = signal<string | null>(null);

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
      };

      const community = await this.communityService.create(dto);
      this.router.navigate(['/communities/manage', community.id, 'members']);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create community');
      console.error('Error creating community:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onCancel() {
    this.router.navigate(['/communities']);
  }
}
