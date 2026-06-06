import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import {
  FinCommanderOverview,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';
import { PulseRingsComponent } from '@optimistic-tanuki/motion-ui';
import { of } from 'rxjs';
import { OverviewPageComponent } from './overview-page.component';

@Component({
  selector: 'otui-pulse-rings',
  standalone: true,
  template: '',
})
class StubPulseRingsComponent {
  @Input() height?: string;
  @Input() speed?: number;
  @Input() intensity?: number;
}

const overviewWithGaps: FinCommanderOverview = {
  plan: {
    id: 'plan-1',
    name: 'Plan',
    description: 'desc',
    defaultWorkspace: 'personal',
    updatedAt: '2025-04-15T14:30:00Z',
  },
  goals: [],
  scenarios: [],
  workspaces: [
    {
      workspace: 'personal',
      summary: null,
      available: false,
    },
  ],
};

function setup(overview: FinCommanderOverview | null) {
  TestBed.overrideComponent(OverviewPageComponent, {
    remove: { imports: [PulseRingsComponent] },
    add: { imports: [StubPulseRingsComponent] },
  });

  return TestBed.configureTestingModule({
    imports: [OverviewPageComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of({ get: () => 'plan-1' }),
          snapshot: { paramMap: { get: () => 'plan-1' } },
        },
      },
      {
        provide: FinCommanderPlanStore,
        useValue: {
          getScope: () => 'personal',
          listPlans: () => (overview ? [overview.plan] : []),
          buildOverview: async () => overview,
        },
      },
    ],
  }).compileComponents();
}

describe('OverviewPageComponent', () => {
  it('formats currency via Intl.NumberFormat', async () => {
    await setup(overviewWithGaps);
    const fixture = TestBed.createComponent(OverviewPageComponent);
    const formatted = fixture.componentInstance.formatBalance(1234.5);
    expect(formatted).toBe('$1,234.50');
    expect(fixture.componentInstance.formatBalance(undefined)).toBe('$0.00');
  });

  it('formats updatedAt via Intl.DateTimeFormat with a fallback', async () => {
    await setup(overviewWithGaps);
    const fixture = TestBed.createComponent(OverviewPageComponent);
    const formatted = fixture.componentInstance.formatUpdatedAt(
      '2025-04-15T14:30:00Z'
    );
    expect(formatted).not.toBe('—');
    expect(formatted).toMatch(/2025/);
    expect(fixture.componentInstance.formatUpdatedAt(undefined)).toBe('—');
    expect(fixture.componentInstance.formatUpdatedAt('not-a-date')).toBe('—');
  });

  it('surfaces next best actions when goals, scenarios, and workspace data are missing', async () => {
    await setup(overviewWithGaps);
    const fixture = TestBed.createComponent(OverviewPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const actions = fixture.componentInstance.nextBestActions();
    const ids = actions.map((action) => action.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'connect-personal',
        'create-goal',
        'create-scenario',
      ])
    );
    expect(actions.length).toBeLessThanOrEqual(4);
  });
});
