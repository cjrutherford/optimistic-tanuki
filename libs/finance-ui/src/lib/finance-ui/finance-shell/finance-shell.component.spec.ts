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
});
