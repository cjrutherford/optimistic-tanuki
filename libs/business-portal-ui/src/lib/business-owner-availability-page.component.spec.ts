import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerAvailabilityPageComponent } from './business-owner-availability-page.component';

describe('BusinessOwnerAvailabilityPageComponent', () => {
  it('updates an existing weekly availability when editing', async () => {
    const updateOwnerAvailability = jest.fn().mockReturnValue(of({ id: 'availability-1' }));

    await TestBed.configureTestingModule({
      imports: [BusinessOwnerAvailabilityPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerAvailabilities: jest.fn().mockReturnValue(of([])),
            getOwnerAvailabilityOverrides: jest.fn().mockReturnValue(of([])),
            createOwnerAvailability: jest.fn().mockReturnValue(of({ id: 'availability-2' })),
            updateOwnerAvailability,
            removeOwnerAvailability: jest.fn().mockReturnValue(of(void 0)),
            createOwnerAvailabilityOverride: jest.fn().mockReturnValue(of({ id: 'override-1' })),
            updateOwnerAvailabilityOverride: jest.fn().mockReturnValue(of({ id: 'override-1' })),
            removeOwnerAvailabilityOverride: jest.fn().mockReturnValue(of(void 0)),
          },
        },
      ],
    }).compileComponents();

    const component = TestBed.runInInjectionContext(
      () => new BusinessOwnerAvailabilityPageComponent()
    );

    component.startEditAvailability({
      id: 'availability-1',
      dayOfWeek: 2,
      startTime: '09:00:00',
      endTime: '12:00:00',
      hourlyRate: 150,
      serviceType: 'Advisory',
      isActive: true,
    } as any);
    component.saveAvailability();

    expect(updateOwnerAvailability).toHaveBeenCalledWith(
      'availability-1',
      expect.objectContaining({
        dayOfWeek: 2,
        serviceType: 'Advisory',
      })
    );
  });
});
