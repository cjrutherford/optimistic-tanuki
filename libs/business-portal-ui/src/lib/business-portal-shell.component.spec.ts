import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

import { BusinessPortalShellComponent } from './business-portal-shell.component';

describe('BusinessPortalShellComponent', () => {
  function createComponent(
    url: string,
    clientTasksEnabled = true,
    invoicesEnabled = false
  ) {
    TestBed.configureTestingModule({
      imports: [BusinessPortalShellComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                portalLabel: 'Owner Workspace',
                portalDescription: 'Manage clients, requests, and settings.',
              },
            },
          },
        },
        {
          provide: Router,
          useValue: {
            url,
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig: jest.fn().mockReturnValue(
              of({
                configId: 'config-1',
                config: {
                  features: {
                    clientTasks: {
                      enabled: clientTasksEnabled,
                      allowClientCompletion: false,
                    },
                    invoices: {
                      enabled: invoicesEnabled,
                    },
                  },
                },
              })
            ),
          },
        },
      ],
    });

    return TestBed.createComponent(BusinessPortalShellComponent)
      .componentInstance;
  }

  it('uses owner workspace links for business owner routes', () => {
    const component = createComponent('/owner/dashboard');

    expect(component.links()).toEqual([
      { path: '/owner/dashboard', label: 'Dashboard' },
      { path: '/owner/requests', label: 'Requests' },
      { path: '/owner/clients', label: 'Clients' },
      { path: '/owner/availability', label: 'Availability' },
      { path: '/owner/site', label: 'Site Editor' },
    ]);
  });

  it('omits the routines link for client routes when client tasks are disabled', () => {
    const component = createComponent('/client/dashboard', false);

    expect(component.links()).toEqual([
      { path: '/client', label: 'Overview' },
      { path: '/client/dashboard', label: 'Dashboard' },
    ]);
  });

  it('shows the billing link when invoices are enabled', () => {
    const component = createComponent('/client/dashboard', false, true);

    expect(component.links()).toEqual([
      { path: '/client', label: 'Overview' },
      { path: '/client/dashboard', label: 'Dashboard' },
      { path: '/client/billing', label: 'Billing' },
    ]);
  });
});
