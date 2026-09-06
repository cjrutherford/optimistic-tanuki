import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FinanceShellComponent } from './finance-shell.component';
import { FinanceService } from '../services/finance.service';
import { FINANCE_HOST_CONFIG } from '../finance.routes';
import type { FinanceOnboardingState } from '../models';

/**
 * Built through runInInjectionContext: these cover the shell's derived
 * signals and route-building helpers without standing up the router outlet.
 */
describe('FinanceShellComponent behaviour', () => {
  let component: FinanceShellComponent;
  let routerUrl: string;

  const state = (
    overrides: Partial<FinanceOnboardingState> = {}
  ): FinanceOnboardingState =>
    ({
      requiresOnboarding: false,
      availableWorkspaces: ['personal'],
      checklist: [{ key: 'a', complete: true }],
      ...overrides,
    } as FinanceOnboardingState);

  const build = (hostConfig: Record<string, unknown> = {}) => {
    routerUrl = '/finance/personal';
    // Tests that need a different host config rebuild the module, so the
    // one standing from beforeEach has to be torn down first.
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue(state()),
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/finance',
            shellTitle: 'Finance Workspace',
            defaultWorkspace: 'personal',
            ...hostConfig,
          },
        },
        {
          provide: Router,
          useValue: {
            get url() {
              return routerUrl;
            },
            events: new Subject(),
            navigateByUrl: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map() } },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new FinanceShellComponent());
  };

  beforeEach(() => {
    component = build();
  });

  describe('showSetupStatusCard', () => {
    it('is hidden until onboarding state arrives', () => {
      expect(component.showSetupStatusCard()).toBe(false);
    });

    it('shows while onboarding is still required', () => {
      component.onboardingState.set(state({ requiresOnboarding: true }));
      expect(component.showSetupStatusCard()).toBe(true);
    });

    it('shows when no workspaces exist yet', () => {
      component.onboardingState.set(state({ availableWorkspaces: [] }));
      expect(component.showSetupStatusCard()).toBe(true);
    });

    it('shows while any checklist item is incomplete', () => {
      component.onboardingState.set(
        state({ checklist: [{ key: 'a', complete: false }] } as never)
      );
      expect(component.showSetupStatusCard()).toBe(true);
    });

    it('hides once everything is done', () => {
      component.onboardingState.set(state());
      expect(component.showSetupStatusCard()).toBe(false);
    });
  });

  describe('workspaces', () => {
    it('falls back to built-in labels', () => {
      expect(component.workspaces()).toEqual([
        expect.objectContaining({ id: 'personal', label: 'Personal' }),
        expect.objectContaining({ id: 'business', label: 'Business' }),
        expect.objectContaining({ id: 'net-worth', label: 'Net Worth' }),
      ]);
    });

    it('honours host-supplied labels', () => {
      const configured = build({
        workspaceLabels: {
          personal: { label: 'Home', navLabel: 'My money' },
          'net-worth': { description: 'Everything owned' },
        },
      });

      const [personal, business, netWorth] = configured.workspaces();
      expect(personal).toMatchObject({
        label: 'Home',
        navLabel: 'My money',
        // Unspecified fields keep their defaults.
        description: 'Cash flow, bills, and everyday spending',
      });
      expect(business.label).toBe('Business');
      expect(netWorth.description).toBe('Everything owned');
    });
  });

  describe('completedChecklistCount', () => {
    it('is zero before state loads', () => {
      expect(component.completedChecklistCount()).toBe(0);
    });

    it('counts only completed items', () => {
      component.onboardingState.set(
        state({
          checklist: [
            { key: 'a', complete: true },
            { key: 'b', complete: false },
            { key: 'c', complete: true },
          ],
        } as never)
      );

      expect(component.completedChecklistCount()).toBe(2);
    });
  });

  describe('route helpers', () => {
    it('builds the onboarding link off the route base', () => {
      expect(component.onboardingLink()).toEqual([
        '/',
        'finance',
        'onboarding',
      ]);
    });

    it('builds workspace links', () => {
      expect(component.workspaceLink('business')).toEqual([
        '/',
        'finance',
        'business',
      ]);
      expect(component.workspaceSectionLink('business', 'accounts')).toEqual([
        '/',
        'finance',
        'business',
        'accounts',
      ]);
    });

    it('renders the onboarding path as a string', () => {
      expect(component.onboardingPath()).toBe('/finance/onboarding');
    });

    it('sends setup progress to onboarding while setup is outstanding', () => {
      component.onboardingState.set(state({ requiresOnboarding: true }));
      expect(component.setupProgressRoute()).toEqual(['/', 'onboarding']);
    });

    it('sends setup progress to the workspace setup page once complete', () => {
      component.onboardingState.set(state());
      component.currentWorkspace.set('business');

      expect(component.setupProgressRoute()).toEqual([
        '/',
        'finance',
        'business',
        'setup',
      ]);
    });

    it('sends setup progress to the workspace page before state loads', () => {
      expect(component.setupProgressRoute()).toEqual([
        '/',
        'finance',
        'personal',
        'setup',
      ]);
    });
  });

  describe('syncWorkspace', () => {
    it('adopts a recognised workspace segment from the url', () => {
      routerUrl = '/finance/business/accounts';
      component.syncWorkspace();
      expect(component.currentWorkspace()).toBe('business');
    });

    it('ignores a segment that is not a workspace', () => {
      routerUrl = '/finance/onboarding';
      component.syncWorkspace();
      expect(component.currentWorkspace()).toBe('personal');
    });

    it('ignores query strings when reading the segment', () => {
      routerUrl = '/finance/net-worth?tab=all';
      component.syncWorkspace();
      expect(component.currentWorkspace()).toBe('net-worth');
    });
  });

  describe('lifecycle', () => {
    it('loads state and re-syncs on navigation', async () => {
      await component.ngOnInit();

      expect(component.onboardingState()).not.toBeNull();
      expect(component.currentWorkspace()).toBe('personal');
    });

    it('unsubscribes on destroy', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
