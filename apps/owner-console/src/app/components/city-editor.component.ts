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
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  LocalityType,
} from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-city-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
    TextInputComponent,
  ],
  templateUrl: './city-editor.component.html',
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
export class CityEditorComponent implements OnInit, OnDestroy {
  cityForm: FormGroup;
  isEditMode = false;
  cityId: string | null = null;
  loading = false;
  saving = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private messageService: MessageService
  ) {
    this.cityForm = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      description: ['', Validators.required],
      countryCode: ['', Validators.required],
      adminArea: ['', Validators.required],
      city: ['', Validators.required],
      population: [null],
      lat: [null],
      lng: [null],
      imageUrl: [''],
      timezone: [''],
      localityType: [LocalityType.CITY],
    });
  }

  ngOnInit(): void {
    this.cityId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.cityId;

    this.cityForm
      .get('name')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((name) => {
        if (name && !this.isEditMode) {
          this.cityForm.patchValue(
            { slug: this.generateSlug(name) },
            { emitEvent: false }
          );
        }
      });

    if (this.isEditMode && this.cityId) {
      this.loadCity(this.cityId);
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

  loadCity(id: string): void {
    this.loading = true;
    this.communityService.getCity(id).subscribe({
      next: (city) => {
        this.cityForm.patchValue(city);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load city.',
          type: 'error',
        });
      },
    });
  }

  save(): void {
    if (this.cityForm.invalid) {
      this.messageService.addMessage({
        content: 'Please fill in all required fields.',
        type: 'error',
      });
      return;
    }

    this.saving = true;
    const formData = this.cityForm.value;

    if (this.isEditMode && this.cityId) {
      this.communityService.updateCity(this.cityId, formData).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'City updated successfully.',
            type: 'success',
          });
          this.router.navigate(['/dashboard/cities']);
        },
        error: (err) => {
          this.saving = false;
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to update city.',
            type: 'error',
          });
        },
      });
    } else {
      this.communityService.createCity(formData).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'City created successfully.',
            type: 'success',
          });
          this.router.navigate(['/dashboard/cities']);
        },
        error: (err) => {
          this.saving = false;
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to create city.',
            type: 'error',
          });
        },
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/dashboard/cities']);
  }
}
