import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  SelectComponent,
} from '@optimistic-tanuki/form-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityJoinPolicy,
  LocalityType,
} from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-community-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
    TextInputComponent,
    SelectComponent,
  ],
  templateUrl: './community-editor.component.html',
  styles: [
    `
      :host {
        display: block;
        padding: var(--spacing-md);
      }
      .editor-container {
        max-width: 800px;
        margin: 0 auto;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      .form-group label {
        font-weight: 500;
        color: var(--text-primary);
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(63, 81, 181, 0.2);
      }
      .form-group textarea {
        min-height: 100px;
        resize: vertical;
      }
      .checkbox-group {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      .checkbox-group input[type='checkbox'] {
        width: 18px;
        height: 18px;
      }
      .checkbox-field {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        cursor: pointer;
        font-weight: 500;
        color: var(--text-primary);
      }
      .checkbox-label input[type='checkbox'] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      .checkbox-hint {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 0;
      }
      .form-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
      }
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
    `,
  ],
})
export class CommunityEditorComponent implements OnInit, OnDestroy {
  communityForm: FormGroup;
  isEditMode = false;
  communityId: string | null = null;
  loading = false;
  saving = false;
  private destroy$ = new Subject<void>();

  joinPolicyOptions = [
    { value: CommunityJoinPolicy.PUBLIC, label: 'Public' },
    {
      value: CommunityJoinPolicy.APPROVAL_REQUIRED,
      label: 'Approval Required',
    },
    { value: CommunityJoinPolicy.INVITE_ONLY, label: 'Invite Only' },
  ];

  localityTypeOptions = [
    { value: LocalityType.CITY, label: 'City' },
    { value: LocalityType.TOWN, label: 'Town' },
    { value: LocalityType.NEIGHBORHOOD, label: 'Neighborhood' },
    { value: LocalityType.COUNTY, label: 'County' },
    { value: LocalityType.REGION, label: 'Region' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private messageService: MessageService
  ) {
    this.communityForm = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      description: ['', Validators.required],
      isPrivate: [false],
      joinPolicy: [CommunityJoinPolicy.PUBLIC],
      localityType: [null],
      countryCode: [''],
      adminArea: [''],
      city: [''],
      population: [null],
      lat: [null],
      lng: [null],
      imageUrl: [''],
      timezone: [''],
    });
  }

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.communityId;

    this.communityForm
      .get('name')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((name) => {
        if (name && !this.isEditMode) {
          this.communityForm.patchValue(
            { slug: this.generateSlug(name) },
            { emitEvent: false }
          );
        }
      });

    if (this.isEditMode && this.communityId) {
      this.loadCommunity(this.communityId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  loadCommunity(id: string): void {
    this.loading = true;
    this.communityService.getCommunity(id).subscribe({
      next: (community) => {
        this.communityForm.patchValue(community);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load community.',
          type: 'error',
        });
      },
    });
  }

  save(): void {
    if (this.communityForm.invalid) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
      return;
    }

    this.saving = true;
    const formData = this.communityForm.value;

    if (this.isEditMode && this.communityId) {
      const updateData: UpdateCommunityDto = formData;
      this.communityService
        .updateCommunity(this.communityId, updateData)
        .subscribe({
          next: () => {
            this.messageService.addMessage({
              content: 'Community updated successfully.',
              type: 'success',
            });
            this.router.navigate(['/dashboard/communities']);
          },
          error: (err) => {
            this.saving = false;
            this.messageService.addMessage({
              content: err.error?.message || 'Failed to update community.',
              type: 'error',
            });
          },
        });
    } else {
      const createData: CreateCommunityDto = formData;
      this.communityService.createCommunity(createData).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Community created successfully.',
            type: 'success',
          });
          this.router.navigate(['/dashboard/communities']);
        },
        error: (err) => {
          this.saving = false;
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to create community.',
            type: 'error',
          });
        },
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/dashboard/communities']);
  }
}
