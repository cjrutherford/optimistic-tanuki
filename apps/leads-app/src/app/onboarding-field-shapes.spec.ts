import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InterviewWizardComponent } from './interview-wizard.component';
import { LeadsService } from './leads.service';

/**
 * Guards the wizard's questions against the shape the profile stores.
 *
 * Two bugs came from these disagreeing, and neither was caught by TypeScript,
 * because the writes go through an index signature:
 *
 *  - `budgetRange` was asked with a single-select but declared `string[]`, so a
 *    bare string reached the backend and `.join`/`.some` threw. The
 *    deterministic fallback shared the fault, so the whole analysis 500'd.
 *  - `yearsExperience` was asked with a multiselect but declared `string`, and
 *    since the resume prefills it, toggling spread "10+" into ['1','0','+'] —
 *    no error at all, just corrupted data in the prompt and the generated CV.
 *
 * A question that collects several values must answer a list-valued field, and
 * one that collects a single value must not.
 */
describe('onboarding question and profile field shapes agree', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewWizardComponent],
      providers: [
        {
          provide: LeadsService,
          useValue: { searchLocations: jest.fn().mockReturnValue(of([])) },
        },
      ],
    }).compileComponents();
  });

  const LIST_INPUTS = new Set(['multiselect', 'chips']);
  const SCALAR_INPUTS = new Set(['single-select', 'text', 'textarea']);

  /** Fields the profile stores as arrays, from UserOnboardingProfile. */
  const LIST_FIELDS = new Set([
    'skills',
    'certifications',
    'companySizeTarget',
    'industries',
    'problemsSolved',
    'outcomes',
    'budgetRange',
    'outreachMethod',
    'leadSignalTypes',
    'excludedCompanies',
    'excludedIndustries',
  ]);

  it('never asks for several values into a scalar field', () => {
    const { questions } = TestBed.createComponent(
      InterviewWizardComponent
    ).componentInstance;

    const wrong = questions
      .filter((q) => LIST_INPUTS.has(q.type) && !LIST_FIELDS.has(q.id))
      .map((q) => `${q.id} (${q.type} -> scalar)`);

    expect(wrong).toEqual([]);
  });

  it('never asks for one value into a list field without wrapping it', () => {
    const component = TestBed.createComponent(
      InterviewWizardComponent
    ).componentInstance;

    for (const question of component.questions.filter(
      (q) => SCALAR_INPUTS.has(q.type) && LIST_FIELDS.has(q.id)
    )) {
      component.setProfileValue(question.id, 'a value');
      const stored = (component.profile as unknown as Record<string, unknown>)[
        question.id
      ];

      // Allowed, but only because setProfileValue wraps it.
      expect(Array.isArray(stored)).toBe(true);
    }
  });
});
