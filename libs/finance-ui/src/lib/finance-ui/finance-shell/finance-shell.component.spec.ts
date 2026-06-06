import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  provideRouter,
} from '@angular/router';
import { Subject } from 'rxjs';
import { FinanceShellComponent } from './finance-shell.component';
import { FinanceService } from '../services/finance.service';
import { FINANCE_HOST_CONFIG } from '../finance.routes';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: '<div>stub</div>',
})
class RouterStubComponent {}

describe('FinanceShellComponent', () => {
  async function renderShell(options: {
    url: string;
    hostConfig: Record<string, unknown>;
    onboardingState: Record<string, unknown>;
  }) {
    const events = new Subject<NavigationEnd>();

    await TestBed.configureTestingModule({
      imports: [FinanceShellComponent],
      providers: [
        provideRouter([
          { path: 'owner/finance', component: RouterStubComponent },
          { path: 'owner/finance/:workspace', component: RouterStubComponent },
          {
            path: 'owner/finance/:workspace/invoices',
            component: RouterStubComponent,
          },
          {
            path: 'owner/finance/:workspace/checkout',
            component: RouterStubComponent,
          },
        ]),
        {
          provide: Router,
          useValue: {
            url: options.url,
            events,
            navigateByUrl: jest.fn().mockResolvedValue(true),
            createUrlTree: jest.fn(),
            serializeUrl: jest.fn().mockReturnValue('/'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {},
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest
              .fn()
              .mockResolvedValue(options.onboardingState),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: options.hostConfig,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinanceShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('redirects root finance entry to the app onboarding flow when setup is incomplete', async () => {
    const events = new Subject<NavigationEnd>();
    const navigateByUrl = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [FinanceShellComponent],
      providers: [
        provideRouter([
          { path: 'onboarding', component: RouterStubComponent },
          { path: 'finance', component: RouterStubComponent },
          { path: 'finance/:workspace', component: RouterStubComponent },
          { path: 'finance/:workspace/setup', component: RouterStubComponent },
        ]),
        {
          provide: Router,
          useValue: {
            url: '/finance',
            events,
            navigateByUrl,
            createUrlTree: jest.fn(),
            serializeUrl: jest.fn().mockReturnValue('/'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {},
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: true,
              availableWorkspaces: [],
              checklist: [],
            }),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/finance',
            shellTitle: 'Ledger',
            defaultWorkspace: 'personal',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinanceShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/onboarding');
  });

  it('redirects embedded finance hosts to their configured onboarding route', async () => {
    const events = new Subject<NavigationEnd>();
    const navigateByUrl = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [FinanceShellComponent],
      providers: [
        provideRouter([
          { path: 'owner/finance', component: RouterStubComponent },
          {
            path: 'owner/finance/onboarding',
            component: RouterStubComponent,
          },
          {
            path: 'owner/finance/:workspace',
            component: RouterStubComponent,
          },
        ]),
        {
          provide: Router,
          useValue: {
            url: '/owner/finance',
            events,
            navigateByUrl,
            createUrlTree: jest.fn(),
            serializeUrl: jest.fn().mockReturnValue('/'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {},
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: true,
              availableWorkspaces: [],
              checklist: [],
            }),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/owner/finance',
            shellTitle: 'Owner Finance',
            defaultWorkspace: 'business',
            onboardingRoute: '/owner/finance/onboarding',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinanceShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/owner/finance/onboarding');
  });

  it('hides budgets and recurring links for the net-worth workspace', async () => {
    const events = new Subject<NavigationEnd>();

    await TestBed.configureTestingModule({
      imports: [FinanceShellComponent],
      providers: [
        provideRouter([
          { path: 'onboarding', component: RouterStubComponent },
          { path: 'finance', component: RouterStubComponent },
          { path: 'finance/:workspace', component: RouterStubComponent },
          { path: 'finance/:workspace/setup', component: RouterStubComponent },
        ]),
        {
          provide: Router,
          useValue: {
            url: '/finance/net-worth',
            events,
            navigateByUrl: jest.fn().mockResolvedValue(true),
            createUrlTree: jest.fn(),
            serializeUrl: jest.fn().mockReturnValue('/'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {},
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['personal', 'net-worth'],
              checklist: [
                { id: 'accounts', label: 'Add account', complete: true },
              ],
            }),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/finance',
            shellTitle: 'Ledger',
            defaultWorkspace: 'personal',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinanceShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Assets');
    expect(fixture.nativeElement.textContent).not.toContain('Budgets');
    expect(fixture.nativeElement.textContent).not.toContain('Recurring');
  });

  it('shows invoice, checkout, and payments links for the business workspace', async () => {
    const events = new Subject<NavigationEnd>();

    await TestBed.configureTestingModule({
      imports: [FinanceShellComponent],
      providers: [
        provideRouter([
          { path: 'onboarding', component: RouterStubComponent },
          { path: 'finance', component: RouterStubComponent },
          { path: 'finance/:workspace', component: RouterStubComponent },
          {
            path: 'finance/:workspace/invoices',
            component: RouterStubComponent,
          },
          {
            path: 'finance/:workspace/checkout',
            component: RouterStubComponent,
          },
          {
            path: 'finance/:workspace/payments',
            component: RouterStubComponent,
          },
        ]),
        {
          provide: Router,
          useValue: {
            url: '/finance/business',
            events,
            navigateByUrl: jest.fn().mockResolvedValue(true),
            createUrlTree: jest.fn(),
            serializeUrl: jest.fn().mockReturnValue('/'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {},
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['business'],
              checklist: [
                { id: 'accounts', label: 'Add account', complete: true },
              ],
            }),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/finance',
            shellTitle: 'Ledger',
            defaultWorkspace: 'business',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FinanceShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Invoices');
    expect(fixture.nativeElement.textContent).toContain('Checkout');
    expect(fixture.nativeElement.textContent).toContain('Payments');
  });

  it('detects the current workspace when mounted below an owner route base', async () => {
    const fixture = await renderShell({
      url: '/owner/finance/business/invoices',
      hostConfig: {
        routeBase: '/owner/finance',
        shellTitle: 'Owner Finance',
        defaultWorkspace: 'business',
      },
      onboardingState: {
        requiresOnboarding: false,
        availableWorkspaces: ['business'],
        checklist: [],
      },
    });

    expect(fixture.componentInstance.currentWorkspace()).toBe('business');
    expect(
      fixture.componentInstance.workspaceSectionLink('business', 'checkout')
    ).toEqual(['/', 'owner', 'finance', 'business', 'checkout']);
  });

  it('hides the setup status card after setup is complete', async () => {
    const fixture = await renderShell({
      url: '/owner/finance/personal/accounts',
      hostConfig: {
        routeBase: '/owner/finance',
        shellTitle: 'Tenant Accounts',
        defaultWorkspace: 'personal',
      },
      onboardingState: {
        requiresOnboarding: false,
        availableWorkspaces: ['personal', 'business', 'net-worth'],
        checklist: [
          { id: 'accounts', label: 'Add account', complete: true },
          {
            id: 'categorize-transactions',
            label: 'Categorize transactions',
            complete: true,
          },
          { id: 'create-budget', label: 'Create budget', complete: true },
        ],
      },
    });

    expect(fixture.nativeElement.textContent).not.toContain('Setup Progress');
    expect(fixture.nativeElement.textContent).not.toContain('Review setup');
  });
});
