import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ResourceManagementComponent } from './resource-management.component';
import { StoreService } from '../services/store.service';

describe('ResourceManagementComponent', () => {
  const storeService = {
    getResources: jest.fn(),
    createResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storeService.getResources.mockReturnValue(
      of([
        {
          id: 'resource-1',
          name: 'Studio Room',
          type: 'room',
          description: 'Private room',
          location: 'Floor 1',
          capacity: 8,
          amenities: ['wifi', 'whiteboard'],
          hourlyRate: 90,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'resource-2',
          name: 'Camera Kit',
          type: 'equipment',
          description: 'Video kit',
          location: 'Storage',
          capacity: 1,
          amenities: ['tripod'],
          hourlyRate: 35,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    storeService.createResource.mockReturnValue(of({ id: 'resource-3' }));
    storeService.updateResource.mockReturnValue(of({ id: 'resource-1' }));
    storeService.deleteResource.mockReturnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ResourceManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  it('filters resources by active state and type', () => {
    const fixture = TestBed.createComponent(ResourceManagementComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    component.setFilter('room');
    expect(component.filteredResources.map((resource) => resource.id)).toEqual([
      'resource-1',
    ]);

    component.setFilter('inactive');
    expect(component.filteredResources.map((resource) => resource.id)).toEqual([
      'resource-2',
    ]);
  });

  it('creates a resource with parsed amenities', () => {
    const fixture = TestBed.createComponent(ResourceManagementComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    component.startCreate();
    component.resourceForm = {
      name: 'Podcast Booth',
      type: 'room',
      description: 'Quiet booth',
      location: 'Floor 2',
      capacity: 4,
      amenitiesText: 'mic, lights, wifi',
      hourlyRate: 120,
      isActive: true,
      imageUrl: '',
    };

    component.saveResource();

    expect(storeService.createResource).toHaveBeenCalledWith({
      name: 'Podcast Booth',
      type: 'room',
      description: 'Quiet booth',
      location: 'Floor 2',
      capacity: 4,
      amenities: ['mic', 'lights', 'wifi'],
      hourlyRate: 120,
      isActive: true,
      imageUrl: '',
    });
  });

  it('updates an existing resource with parsed amenities', () => {
    const fixture = TestBed.createComponent(ResourceManagementComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    component.startEdit(component.resources[0]);
    component.resourceForm.amenitiesText = 'wifi, whiteboard, monitor';

    component.saveResource();

    expect(storeService.updateResource).toHaveBeenCalledWith('resource-1', {
      name: 'Studio Room',
      type: 'room',
      description: 'Private room',
      location: 'Floor 1',
      capacity: 8,
      amenities: ['wifi', 'whiteboard', 'monitor'],
      hourlyRate: 90,
      isActive: true,
      imageUrl: '',
    });
  });

  it('deletes a resource after confirmation', () => {
    const fixture = TestBed.createComponent(ResourceManagementComponent);
    const component = fixture.componentInstance;
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.detectChanges();
    component.deleteResource(component.resources[0]);

    expect(storeService.deleteResource).toHaveBeenCalledWith('resource-1');
  });

  it('renders resources through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(ResourceManagementComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });
});
