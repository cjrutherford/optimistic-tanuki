import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';

import { BusinessPortalShellComponent } from './business-portal-shell.component';

describe('BusinessPortalShellComponent', () => {
  function createComponent(
    url: string,
    clientTasksEnabled = true,
    invoicesEnabled = false,
    siteSlug: string | null = null
  ) {
    const siteConfigStore = {
      site: () => ({
        features: {
          clientTasks: {
            enabled: clientTasksEnabled,
            allowClientCompletion: false,
          },
          invoices: {
            enabled: invoicesEnabled,
          },
        },
      }),
      fetch: jest.fn().mockReturnValue(of(null)),
    };

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
              paramMap: {
                get: (key: string) => (key === 'siteSlug' ? siteSlug : null),
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
          provide: BusinessSiteConfigStore,
          useValue: siteConfigStore,
        },
      ],
    });

    const fixture = TestBed.createComponent(BusinessPortalShellComponent);

    return {
      component: fixture.componentInstance,
      siteConfigStore,
    };
  }

  it('uses owner workspace links for business owner routes', () => {
    const { component } = createComponent('/owner/dashboard');

    expect(component.links()).toEqual([
      { path: '/owner/dashboard', label: 'Dashboard' },
      { path: '/owner/requests', label: 'Requests' },
      { path: '/owner/clients', label: 'Clients' },
      { path: '/owner/availability', label: 'Availability' },
      { path: '/owner/products', label: 'Products' },
      { path: '/owner/campaigns', label: 'Campaigns' },
      { path: '/owner/site', label: 'Site Editor' },
    ]);
  });

  it('shows owner finance links when invoices are enabled', () => {
    const { component } = createComponent('/owner/dashboard', true, true);

    expect(component.links()).toEqual([
      { path: '/owner/dashboard', label: 'Dashboard' },
      { path: '/owner/requests', label: 'Requests' },
      { path: '/owner/clients', label: 'Clients' },
      { path: '/owner/availability', label: 'Availability' },
      { path: '/owner/products', label: 'Products' },
      { path: '/owner/campaigns', label: 'Campaigns' },
      { path: '/owner/finance/business/invoices', label: 'Invoices' },
      { path: '/owner/finance/business/checkout', label: 'Checkout' },
      { path: '/owner/finance/business/payments', label: 'Payments' },
      { path: '/owner/site', label: 'Site Editor' },
    ]);
  });

  it('uses hosted owner product links when the current owner route is business-scoped', () => {
    const { component } = createComponent(
      '/sites/steady-hand-contracting/owner/dashboard',
      true,
      false,
      'steady-hand-contracting'
    );

    expect(component.links()).toEqual([
      {
        path: '/sites/steady-hand-contracting/owner/dashboard',
        label: 'Dashboard',
      },
      {
        path: '/sites/steady-hand-contracting/owner/requests',
        label: 'Requests',
      },
      {
        path: '/sites/steady-hand-contracting/owner/clients',
        label: 'Clients',
      },
      {
        path: '/sites/steady-hand-contracting/owner/availability',
        label: 'Availability',
      },
      {
        path: '/sites/steady-hand-contracting/owner/products',
        label: 'Products',
      },
      {
        path: '/sites/steady-hand-contracting/owner/campaigns',
        label: 'Campaigns',
      },
      {
        path: '/sites/steady-hand-contracting/owner/site',
        label: 'Site Editor',
      },
    ]);
  });

  it('omits the routines link for client routes when client tasks are disabled', () => {
    const { component } = createComponent('/client/dashboard', false);

    expect(component.links()).toEqual([
      { path: '/client', label: 'Overview' },
      { path: '/client/dashboard', label: 'Dashboard' },
    ]);
  });

  it('shows the billing link when invoices are enabled', () => {
    const { component } = createComponent('/client/dashboard', false, true);

    expect(component.links()).toEqual([
      { path: '/client', label: 'Overview' },
      { path: '/client/dashboard', label: 'Dashboard' },
      { path: '/client/billing', label: 'Billing' },
    ]);
  });

  it('uses hosted client portal links when the current route is business-scoped', () => {
    const { component } = createComponent(
      '/sites/steady-hand-contracting/client/dashboard',
      true,
      true,
      'steady-hand-contracting'
    );

    expect(component.links()).toEqual([
      { path: '/sites/steady-hand-contracting/client', label: 'Overview' },
      {
        path: '/sites/steady-hand-contracting/client/dashboard',
        label: 'Dashboard',
      },
      {
        path: '/sites/steady-hand-contracting/client/routines',
        label: 'Routines',
      },
      {
        path: '/sites/steady-hand-contracting/client/billing',
        label: 'Billing',
      },
    ]);
  });

  it('forces a site-config refresh when the portal shell is created', () => {
    const { siteConfigStore } = createComponent('/owner/dashboard');

    expect(siteConfigStore.fetch).toHaveBeenCalledWith(true, null);
  });
});
