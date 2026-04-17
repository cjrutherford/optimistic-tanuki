import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { SetupChecklistComponent } from './setup-checklist.component';
import { FinanceService } from '../services/finance.service';

describe('SetupChecklistComponent', () => {
  it('does not show budget setup tasks for the net-worth workspace', async () => {
    await TestBed.configureTestingModule({
      imports: [SetupChecklistComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ workspace: 'net-worth' }),
            },
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              requiresOnboarding: false,
              availableWorkspaces: ['personal', 'net-worth'],
              checklist: [],
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SetupChecklistComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Net worth setup checklist'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Create at least one active budget'
    );
  });
});
