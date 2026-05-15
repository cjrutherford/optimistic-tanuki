import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../services/store.service';
import {
  Resource,
  CreateResourceDto,
  UpdateResourceDto,
} from '@optimistic-tanuki/ui-models';

type ResourceFilter = 'all' | 'room' | 'equipment' | 'vehicle' | 'inactive';

type ResourceForm = (CreateResourceDto & { id?: string }) & {
  amenitiesText: string;
};

@Component({
  selector: 'app-resource-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-management.component.html',
  styleUrls: ['./resource-management.component.scss'],
})
export class ResourceManagementComponent implements OnInit {
  readonly filters: ResourceFilter[] = [
    'all',
    'room',
    'equipment',
    'vehicle',
    'inactive',
  ];

  filter: ResourceFilter = 'all';
  resources: Resource[] = [];
  selectedResource: Resource | null = null;
  isEditing = false;
  isCreating = false;
  loading = false;
  error: string | null = null;

  resourceForm: ResourceForm = this.getEmptyForm();

  constructor(private storeService: StoreService) {}

  ngOnInit(): void {
    this.loadResources();
  }

  loadResources(): void {
    this.loading = true;
    this.error = null;
    this.storeService.getResources().subscribe({
      next: (resources) => {
        this.resources = resources;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load resources';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get filteredResources(): Resource[] {
    switch (this.filter) {
      case 'inactive':
        return this.resources.filter((resource) => !resource.isActive);
      case 'room':
      case 'equipment':
      case 'vehicle':
        return this.resources.filter(
          (resource) => resource.type === this.filter
        );
      default:
        return this.resources;
    }
  }

  get activeResourceCount(): number {
    return this.resources.filter((resource) => resource.isActive).length;
  }

  get inactiveResourceCount(): number {
    return this.resources.filter((resource) => !resource.isActive).length;
  }

  setFilter(filter: ResourceFilter): void {
    this.filter = filter;
  }

  startCreate(): void {
    this.isCreating = true;
    this.isEditing = false;
    this.selectedResource = null;
    this.resourceForm = this.getEmptyForm();
  }

  startEdit(resource: Resource): void {
    this.isEditing = true;
    this.isCreating = false;
    this.selectedResource = resource;
    this.resourceForm = {
      id: resource.id,
      name: resource.name,
      type: resource.type,
      description: resource.description ?? '',
      location: resource.location ?? '',
      capacity: resource.capacity,
      amenitiesText: (resource.amenities ?? []).join(', '),
      hourlyRate: resource.hourlyRate,
      isActive: resource.isActive,
      imageUrl: resource.imageUrl ?? '',
    };
  }

  cancelEdit(): void {
    this.isCreating = false;
    this.isEditing = false;
    this.selectedResource = null;
    this.resourceForm = this.getEmptyForm();
  }

  saveResource(): void {
    if (this.isCreating) {
      this.createResource();
    } else if (this.isEditing && this.selectedResource) {
      this.updateResource();
    }
  }

  createResource(): void {
    this.loading = true;
    this.error = null;

    const dto: CreateResourceDto = this.toCreateDto();
    this.storeService.createResource(dto).subscribe({
      next: () => {
        this.loadResources();
        this.cancelEdit();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to create resource';
        this.loading = false;
        console.error(err);
      },
    });
  }

  updateResource(): void {
    if (!this.selectedResource) {
      return;
    }

    this.loading = true;
    this.error = null;

    const dto: UpdateResourceDto = this.toUpdateDto();
    this.storeService.updateResource(this.selectedResource.id, dto).subscribe({
      next: () => {
        this.loadResources();
        this.cancelEdit();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to update resource';
        this.loading = false;
        console.error(err);
      },
    });
  }

  deleteResource(resource: Resource): void {
    if (!confirm(`Are you sure you want to delete "${resource.name}"?`)) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.storeService.deleteResource(resource.id).subscribe({
      next: () => {
        this.loadResources();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to delete resource';
        this.loading = false;
        console.error(err);
      },
    });
  }

  private getEmptyForm(): ResourceForm {
    return {
      name: '',
      type: 'room',
      description: '',
      location: '',
      capacity: undefined,
      amenitiesText: '',
      hourlyRate: undefined,
      isActive: true,
      imageUrl: '',
    };
  }

  private parseAmenities(): string[] {
    return this.resourceForm.amenitiesText
      .split(',')
      .map((amenity) => amenity.trim())
      .filter(Boolean);
  }

  private toCreateDto(): CreateResourceDto {
    return {
      name: this.resourceForm.name,
      type: this.resourceForm.type,
      description: this.resourceForm.description,
      location: this.resourceForm.location,
      capacity: this.resourceForm.capacity,
      amenities: this.parseAmenities(),
      hourlyRate: this.resourceForm.hourlyRate,
      isActive: this.resourceForm.isActive,
      imageUrl: this.resourceForm.imageUrl,
    };
  }

  private toUpdateDto(): UpdateResourceDto {
    return {
      name: this.resourceForm.name,
      type: this.resourceForm.type,
      description: this.resourceForm.description,
      location: this.resourceForm.location,
      capacity: this.resourceForm.capacity,
      amenities: this.parseAmenities(),
      hourlyRate: this.resourceForm.hourlyRate,
      isActive: this.resourceForm.isActive,
      imageUrl: this.resourceForm.imageUrl,
    };
  }
}
