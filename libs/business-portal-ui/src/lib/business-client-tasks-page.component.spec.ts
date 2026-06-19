import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientTasksPageComponent } from './business-client-tasks-page.component';

describe('BusinessClientTasksPageComponent', () => {
  async function render(allowClientCompletion: boolean) {
    const api = {
      getClientRoutines: jest.fn().mockReturnValue(
        of([
          {
            id: 'routine-1',
            clientId: 'client-1',
            clientName: 'Client One',
            title: 'Strength reset',
            summary: 'Three weekly sessions.',
            focusAreas: ['Strength'],
            status: 'assigned',
            createdAt: '2026-05-07T00:00:00.000Z',
          },
        ])
      ),
      submitCheckIn: jest.fn().mockReturnValue(of({ id: 'checkin-1' })),
      completeClientRoutine: jest
        .fn()
        .mockReturnValue(of({ id: 'routine-1', status: 'completed' })),
    };

    await TestBed.configureTestingModule({
      imports: [BusinessClientTasksPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
          },
        },
        {
          provide: BusinessApiService,
          useValue: api,
        },
        {
          provide: BusinessAuthService,
          useValue: {
            clientUser: signal({
              userId: 'client-1',
              profileId: 'profile-1',
              email: 'client@example.com',
            }).asReadonly(),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: signal({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                clientTasks: {
                  enabled: true,
                  allowClientCompletion,
                },
              },
            }).asReadonly(),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessClientTasksPageComponent);
    fixture.detectChanges();
    return { fixture, api };
  }

  it('shows completion controls when client completion is enabled', async () => {
    const { fixture } = await render(true);
    expect(fixture.nativeElement.textContent).toContain('Mark complete');
  });

  it('suppresses completion controls when client completion is disabled', async () => {
    const { fixture } = await render(false);
    expect(fixture.nativeElement.textContent).not.toContain('Mark complete');
  });

  it('updates the routine state immediately after completion without a refresh', async () => {
    const { fixture, api } = await render(true);
    const component = fixture.componentInstance;

    component.completeRoutine('routine-1');
    fixture.detectChanges();

    expect(api.completeClientRoutine).toHaveBeenCalledWith(
      'routine-1',
      'steady-hand-contracting'
    );
    expect(fixture.nativeElement.textContent).toContain('Completed');
    expect(fixture.nativeElement.textContent).not.toContain('Mark complete');
  });

  it('uses the hosted tenant slug for routines and check-ins', async () => {
    const { fixture, api } = await render(true);
    const component = fixture.componentInstance;

    component.assignmentId = 'routine-1';
    component.submitCheckIn();

    expect(api.getClientRoutines).toHaveBeenCalledWith(
      'client-1',
      'steady-hand-contracting'
    );
    expect(api.submitCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        siteSlug: 'steady-hand-contracting',
      })
    );
  });
});
