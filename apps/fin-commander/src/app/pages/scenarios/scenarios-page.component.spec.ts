import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import {
  FinCommanderPlanStore,
  FinCommanderScenario,
} from '@optimistic-tanuki/fin-commander-data-access';
import { of } from 'rxjs';
import { ScenariosPageComponent } from './scenarios-page.component';

const seedScenarios: FinCommanderScenario[] = [
  {
    id: 'sc-existing',
    planId: 'plan-1',
    name: 'Job Change',
    summary: 'Salary bump',
    assumptions: [
      { id: 'a-1', label: 'Salary', delta: '+10%', impactArea: 'income' },
    ],
  },
];

function setup() {
  const store = {
    getScope: () => 'personal',
    listPlans: () => [{ id: 'plan-1' }],
    listScenarios: () => [...seedScenarios],
    refreshScenarios: jest.fn().mockResolvedValue(seedScenarios),
    saveScenario: jest.fn().mockResolvedValue(seedScenarios[0]),
    deleteScenario: jest.fn().mockResolvedValue(undefined),
  } as unknown as FinCommanderPlanStore;

  TestBed.configureTestingModule({
    imports: [ScenariosPageComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of({ get: () => 'plan-1' }),
          snapshot: { paramMap: { get: () => 'plan-1' } },
        },
      },
      { provide: FinCommanderPlanStore, useValue: store },
    ],
  });

  return store;
}

describe('ScenariosPageComponent', () => {
  it('reports validation errors for an empty draft', () => {
    setup();
    const fixture = TestBed.createComponent(ScenariosPageComponent);
    fixture.detectChanges();

    const errors = fixture.componentInstance.draftErrors();
    expect(errors).toEqual(
      expect.arrayContaining([
        'Scenario name is required.',
        'Summary is required.',
        'Assumption label is required.',
        'Assumption delta is required.',
      ])
    );
  });

  it('uses one page-level heading and keeps validation errors as a list', () => {
    setup();
    const fixture = TestBed.createComponent(ScenariosPageComponent);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h1');
    const errors = fixture.nativeElement.querySelector('.hint-errors');

    expect(heading?.textContent).toContain('Model what-if assumptions');
    expect(errors?.getAttribute('role')).toBeNull();
    expect(errors?.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses a sequential heading level for the scenario editor', () => {
    setup();
    const fixture = TestBed.createComponent(ScenariosPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('h2.editor-title')?.textContent
    ).toContain('Model a what-if');
  });

  it('requires confirmation before deleting a scenario', async () => {
    const store = setup();
    const fixture = TestBed.createComponent(ScenariosPageComponent);
    fixture.detectChanges();

    const cmp = fixture.componentInstance;
    cmp.requestDelete('sc-existing');
    expect(cmp.pendingDeleteId()).toBe('sc-existing');
    expect(store.deleteScenario as jest.Mock).not.toHaveBeenCalled();

    cmp.cancelDelete();
    expect(cmp.pendingDeleteId()).toBeNull();

    cmp.requestDelete('sc-existing');
    await cmp.confirmDelete('sc-existing');
    expect(store.deleteScenario as jest.Mock).toHaveBeenCalledWith(
      'sc-existing'
    );
    expect(cmp.statusMessage()).toContain('Job Change');
  });
});
