import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { SignalMeshComponent } from '@optimistic-tanuki/motion-ui';
import { of } from 'rxjs';
import { PermissionsService } from '../../permissions.service';
import { CommanderShellComponent } from './commander-shell.component';

@Component({
  selector: 'otui-signal-mesh',
  standalone: true,
  template: '',
})
class StubSignalMeshComponent {
  @Input() height?: string;
  @Input() density?: number;
  @Input() speed?: number;
  @Input() intensity?: number;
}

const activePlan = {
  id: 'plan-1',
  name: 'Test Plan',
  description: 'A test plan',
  defaultWorkspace: 'personal',
  updatedAt: new Date().toISOString(),
};

describe('CommanderShellComponent (a11y)', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(CommanderShellComponent, {
      remove: { imports: [SignalMeshComponent] },
      add: { imports: [StubSignalMeshComponent] },
    });

    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'planId' ? 'plan-1' : null),
            }),
            snapshot: { paramMap: { get: () => 'plan-1' } },
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => 'personal',
            listPlans: () => [activePlan],
            getPlan: (id: string) => (id === 'plan-1' ? activePlan : null),
            savePlan: jest.fn(),
          },
        },
        {
          provide: PermissionsService,
          useValue: { can: () => true },
        },
      ],
    }).compileComponents();
  });

  it('renders a skip link targeting the main region', () => {
    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    const skip = fixture.nativeElement.querySelector('a.skip-link');
    const main = fixture.nativeElement.querySelector('main#fc-main');
    expect(skip).not.toBeNull();
    expect(skip.getAttribute('href')).toBe('#fc-main');
    expect(main).not.toBeNull();
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('exposes aria-expanded on the plan drawer toggle', () => {
    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.plan-drawer-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('plan-drawer');
  });
});
