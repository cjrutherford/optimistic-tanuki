import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InterviewWizardComponent } from './interview-wizard.component';
import { LeadsService } from './leads.service';

/**
 * The spec beside this one covers the chip/question flow. These cover the
 * profile accessors, the mad-lib and resume result handlers, and the location
 * autocomplete.
 */
describe('InterviewWizardComponent helpers', () => {
  let component: InterviewWizardComponent;
  const leadsService = { searchLocations: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    leadsService.searchLocations.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [InterviewWizardComponent],
      providers: [{ provide: LeadsService, useValue: leadsService }],
    }).compileComponents();

    component = TestBed.createComponent(
      InterviewWizardComponent
    ).componentInstance;
  });

  const profileAs = () =>
    component.profile as unknown as Record<string, unknown>;

  describe('profile accessors', () => {
    it('reads a raw value', () => {
      profileAs()['serviceOffer'] = 'Consulting';
      expect(component.getProfileValue('serviceOffer')).toBe('Consulting');
    });

    it('reads a list value, defaulting to empty for non-lists', () => {
      profileAs()['skills'] = ['React'];
      expect(component.getProfileListValue('skills')).toEqual(['React']);

      profileAs()['serviceOffer'] = 'not a list';
      expect(component.getProfileListValue('serviceOffer')).toEqual([]);
    });

    it('writes a plain value', () => {
      component.setProfileValue('serviceOffer', 'Consulting');
      expect(profileAs()['serviceOffer']).toBe('Consulting');
    });

    it('coerces the search radius to a number', () => {
      component.setProfileValue('localSearchRadiusMiles', '25');
      expect(profileAs()['localSearchRadiusMiles']).toBe(25);
    });

    it('wraps a scalar answer for a list-valued field', () => {
      // Writing the bare string here is what previously left budgetRange as a
      // string in a string[] field and broke the backend analysis.
      component.setProfileValue('budgetRange', '10k-50k');
      expect(profileAs()['budgetRange']).toEqual(['10k-50k']);
    });

    it('clears the location input when the location is set', () => {
      component.locationInputValue = 'typed';

      component.setProfileValue('localSearchLocation', 'Savannah, GA');

      expect(component.locationInputValue).toBe('');
      expect(profileAs()['localSearchLocation']).toBe('Savannah, GA');
    });
  });

  describe('isAnswered', () => {
    it('treats a non-empty list as answered', () => {
      profileAs()['skills'] = ['React'];
      expect(component.isAnswered('skills')).toBe(true);
    });

    it('treats an empty list as unanswered', () => {
      profileAs()['skills'] = [];
      expect(component.isAnswered('skills')).toBe(false);
    });

    it('falls back to truthiness for scalars', () => {
      profileAs()['serviceOffer'] = 'Consulting';
      expect(component.isAnswered('serviceOffer')).toBe(true);

      profileAs()['serviceOffer'] = '';
      expect(component.isAnswered('serviceOffer')).toBe(false);
    });
  });

  describe('prefill provenance', () => {
    it('has no source label without a recorded source', () => {
      expect(component.getCurrentQuestionSourceLabel()).toBeNull();
    });

    it('names each prefill source', () => {
      const id = component.currentQuestion.id;
      component.profile.prefillSourceByField = {
        [id]: 'mad-lib+resume',
      } as never;
      expect(component.getCurrentQuestionSourceLabel()).toBe(
        'Prefilled from your intro and resume'
      );

      component.profile.prefillSourceByField = { [id]: 'mad-lib' } as never;
      expect(component.getCurrentQuestionSourceLabel()).toBe(
        'Suggested from your intro'
      );

      component.profile.prefillSourceByField = { [id]: 'resume' } as never;
      expect(component.getCurrentQuestionSourceLabel()).toBe(
        'Prefilled from your resume'
      );
    });

    it('returns evidence when present, else an empty list', () => {
      const id = component.currentQuestion.id;
      expect(component.getCurrentQuestionEvidence()).toEqual([]);

      component.profile.prefillEvidenceByField = {
        [id]: ['said so in the intro'],
      } as never;
      expect(component.getCurrentQuestionEvidence()).toEqual([
        'said so in the intro',
      ]);
    });
  });

  describe('mad-lib composition', () => {
    it('keeps the readable sentence in sync with the composer', () => {
      component.onCompositionChange({
        sentence: 'I help bakeries with logistics.',
        values: { who: 'bakeries' },
      } as never);

      expect(component.madLibValue).toBe('I help bakeries with logistics.');
    });

    it('switches between freeform and composer', () => {
      component.useFreeform();
      expect(component.madLibFreeform).toBe(true);

      component.useComposer();
      expect(component.madLibFreeform).toBe(false);
    });

    it('can analyze freeform only with text', () => {
      component.useFreeform();
      component.madLibValue = '   ';
      expect(component.canAnalyzeMadLib).toBe(false);

      component.madLibValue = 'I help bakeries.';
      expect(component.canAnalyzeMadLib).toBe(true);
    });

    it('can analyze the composer only once it has values', () => {
      component.useComposer();
      component.composition = { sentence: '', values: {} } as never;
      expect(component.canAnalyzeMadLib).toBe(false);

      component.composition = {
        sentence: 'x',
        values: { who: 'bakeries' },
      } as never;
      expect(component.canAnalyzeMadLib).toBe(true);
    });

    it('does nothing when analysis is not possible', () => {
      const emit = jest.spyOn(component.analyzeMadLib, 'emit');
      component.useFreeform();
      component.madLibValue = '';

      component.requestMadLibAnalysis();

      expect(emit).not.toHaveBeenCalled();
      expect(component.isAnalyzing).toBe(false);
    });

    it('sends the structured composition from the composer path', () => {
      const emit = jest.spyOn(component.analyzeMadLib, 'emit');
      component.useComposer();
      component.composition = {
        sentence: 'I help bakeries.',
        values: { who: 'bakeries' },
      } as never;
      component.madLibValue = '  I help bakeries.  ';

      component.requestMadLibAnalysis();

      expect(component.isAnalyzing).toBe(true);
      expect(emit).toHaveBeenCalledWith({
        text: 'I help bakeries.',
        composition: component.composition,
      });
    });

    it('omits the composition on the freeform path', () => {
      const emit = jest.spyOn(component.analyzeMadLib, 'emit');
      component.useFreeform();
      component.madLibValue = 'Freeform text';

      component.requestMadLibAnalysis();

      expect(emit).toHaveBeenCalledWith({
        text: 'Freeform text',
        composition: undefined,
      });
    });

    it('advances to the profile stage once analyzed', () => {
      component.isAnalyzing = true;

      component.onMadLibAnalyzed({
        summary: 'Helps bakeries',
        suggestedServiceOffer: 'Logistics',
        suggestedSkills: ['ops'],
        suggestedIdealCustomer: 'Bakeries',
      } as never);

      expect(component.isAnalyzing).toBe(false);
      expect(component.profile.madLibSummary).toBe('Helps bakeries');
      expect(component.currentStage).toBe('profile');
    });

    it('stops the spinner when analysis fails', () => {
      component.isAnalyzing = true;

      component.onMadLibFailed();

      expect(component.isAnalyzing).toBe(false);
      expect(component.currentStage).not.toBe('profile');
    });
  });

  describe('resume handling', () => {
    it('ignores a file input with no file', () => {
      const emit = jest.spyOn(component.parseResume, 'emit');

      component.onResumeFileSelected({
        target: { files: [] },
      } as unknown as Event);

      expect(emit).not.toHaveBeenCalled();
      expect(component.isResumeParsing).toBe(false);
    });

    it('emits the chosen file and records its name', () => {
      const emit = jest.spyOn(component.parseResume, 'emit');
      const file = new File(['cv'], 'ada-resume.pdf');

      component.onResumeFileSelected({
        target: { files: [file] },
      } as unknown as Event);

      expect(component.resumeFileName).toBe('ada-resume.pdf');
      expect(component.isResumeParsing).toBe(true);
      expect(emit).toHaveBeenCalledWith(file);
    });

    it('stores the parsed resume and moves to the mad-lib stage', () => {
      component.isResumeParsing = true;

      component.onResumeParsed({
        summary: 'Ops lead',
        skills: ['ops'],
        experience: ['Acme'],
        certifications: ['PMP'],
        roleSummaries: ['Led ops'],
      } as never);

      expect(component.isResumeParsing).toBe(false);
      expect(component.profile.resumeParseSummary).toBe('Ops lead');
      expect(component.profile.resumeDerivedSkills).toEqual(['ops']);
      expect(component.profile.resumeDerivedCertifications).toEqual(['PMP']);
      expect(component.currentStage).toBe('mad-lib');
    });

    it('stops the spinner when parsing fails', () => {
      component.isResumeParsing = true;

      component.onResumeParseFailed();

      expect(component.isResumeParsing).toBe(false);
    });

    it('skips straight to the mad-lib stage', () => {
      component.skipResumeStep();
      expect(component.currentStage).toBe('mad-lib');
    });
  });

  describe('location autocomplete', () => {
    it('does not search below two characters', () => {
      component.onLocationInput('a');

      expect(leadsService.searchLocations).not.toHaveBeenCalled();
      expect(component.locationSuggestions).toEqual([]);
    });

    it('publishes suggestions for a long enough query', () => {
      leadsService.searchLocations.mockReturnValue(
        of([{ description: 'Savannah, GA' }])
      );

      component.onLocationInput(' sav ');

      expect(leadsService.searchLocations).toHaveBeenCalledWith('sav');
      expect(component.locationSuggestions).toEqual([
        { description: 'Savannah, GA' },
      ]);
    });

    it('clears suggestions when the lookup fails', () => {
      leadsService.searchLocations.mockReturnValue(
        throwError(() => new Error('offline'))
      );

      component.onLocationInput('sav');

      expect(component.locationSuggestions).toEqual([]);
    });

    it('applies a suggestion to the profile', () => {
      component.locationSuggestions = [
        { description: 'Savannah, GA' },
      ] as never;

      component.applyLocationSuggestion({
        description: 'Savannah, GA',
      } as never);

      expect(profileAs()['localSearchLocation']).toBe('Savannah, GA');
      expect(component.locationSuggestions).toEqual([]);
    });

    it('commits typed text, ignoring blanks', () => {
      component.locationInputValue = '   ';
      component.commitLocationInput();
      expect(profileAs()['localSearchLocation']).toBeFalsy();

      component.locationInputValue = '  Atlanta, GA ';
      component.commitLocationInput();
      expect(profileAs()['localSearchLocation']).toBe('Atlanta, GA');
    });

    it('clears the selection', () => {
      component.locationInputValue = 'Atlanta';
      component.commitLocationInput();

      component.clearLocationSelection();

      expect(profileAs()['localSearchLocation']).toBe('');
      expect(component.locationInputValue).toBe('');
    });

    it('commits on Enter only', () => {
      component.locationInputValue = 'Atlanta';
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        cancelable: true,
      });

      component.onLocationInputKeydown(tab);
      expect(profileAs()['localSearchLocation']).toBeFalsy();

      const enter = new KeyboardEvent('keydown', {
        key: 'Enter',
        cancelable: true,
      });
      component.onLocationInputKeydown(enter);
      expect(enter.defaultPrevented).toBe(true);
      expect(profileAs()['localSearchLocation']).toBe('Atlanta');
    });

    it('closes suggestions after a delay', () => {
      jest.useFakeTimers();
      component.locationSuggestions = [{ description: 'x' }] as never;

      component.closeLocationSuggestions();
      jest.advanceTimersByTime(200);

      expect(component.locationSuggestions).toEqual([]);
      jest.useRealTimers();
    });
  });

  describe('chips and multi-select', () => {
    it('ignores a blank chip', () => {
      component.newChipValue = '   ';
      component.addChip('skills');
      expect(component.getProfileListValue('skills')).toEqual([]);
    });

    it('does not add a duplicate chip', () => {
      profileAs()['skills'] = ['React'];
      component.newChipValue = 'React';

      component.addChip('skills');

      expect(component.getProfileListValue('skills')).toEqual(['React']);
      // The input is only cleared on a real addition.
      expect(component.newChipValue).toBe('React');
    });

    it('removes a chip', () => {
      profileAs()['skills'] = ['React', 'Vue'];

      component.removeChip('skills', 'React');

      expect(component.getProfileListValue('skills')).toEqual(['Vue']);
    });

    it('toggles a multi-select value on and off', () => {
      component.toggleMultiSelect('industries', 'retail');
      expect(component.isMultiSelected('industries', 'retail')).toBe(true);

      component.toggleMultiSelect('industries', 'retail');
      expect(component.isMultiSelected('industries', 'retail')).toBe(false);
    });

    it('treats a stray scalar as the single existing selection', () => {
      // Spreading a string here would turn "10+" into ['1','0','+'].
      profileAs()['teamSize'] = '10+';

      component.toggleMultiSelect('teamSize', '50+');

      expect(profileAs()['teamSize']).toEqual(['10+', '50+']);
    });
  });
});
