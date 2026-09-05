import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { TopicsComponent } from './topics.component';
import { LeadsService } from './leads.service';
import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

/**
 * The spec beside this one drives the topic list and form through the
 * template. These cover the pure summary/label helpers and the Google Maps
 * input handling, which that one does not reach.
 */
describe('TopicsComponent helpers', () => {
  let component: TopicsComponent;
  const leadsService = {
    getTopics: jest.fn(),
    createTopic: jest.fn(),
    updateTopic: jest.fn(),
    deleteTopic: jest.fn(),
    toggleTopic: jest.fn(),
    runTopicDiscovery: jest.fn(),
    getTopicDiscoveryStatus: jest.fn(),
    searchLocations: jest.fn(),
  };

  const topic = (overrides: Record<string, unknown> = {}) =>
    ({ id: 'topic-1', name: 'Bakeries', sources: [], ...overrides } as never);

  beforeEach(async () => {
    jest.clearAllMocks();
    leadsService.getTopics.mockReturnValue(of([]));
    leadsService.searchLocations.mockReturnValue(of([]));
    leadsService.getTopicDiscoveryStatus.mockReturnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [TopicsComponent],
      providers: [
        provideRouter([]),
        { provide: LeadsService, useValue: leadsService },
        { provide: ThemeService, useValue: { setPersonality: jest.fn() } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(TopicsComponent).componentInstance;
  });

  describe('getTopicSources', () => {
    it('uses the topic sources when it has any', () => {
      const sources = [LeadDiscoverySource.GOOGLE_MAPS];
      expect(component.getTopicSources(topic({ sources }))).toEqual(sources);
    });

    it('falls back to every available source', () => {
      expect(component.getTopicSources(topic({ sources: [] }))).toEqual(
        component.availableSources
      );
    });
  });

  describe('getTopicGoogleMapsSummary', () => {
    const mapsTopic = (overrides: Record<string, unknown> = {}) =>
      topic({ sources: [LeadDiscoverySource.GOOGLE_MAPS], ...overrides });

    it('is null when the topic does not search Google Maps', () => {
      expect(
        component.getTopicGoogleMapsSummary(
          topic({ sources: [LeadDiscoverySource.ATS] })
        )
      ).toBeNull();
    });

    it('joins cities, types, location and radius', () => {
      const summary = component.getTopicGoogleMapsSummary(
        mapsTopic({
          googleMapsCities: ['Savannah', 'Atlanta'],
          googleMapsTypes: ['bakery'],
          googleMapsLocation: 'Georgia',
          googleMapsRadiusMiles: 25,
        })
      );

      expect(summary).toBe('Savannah, Atlanta · bakery · Georgia · 25 mi');
    });

    it('names each missing part rather than leaving it blank', () => {
      const summary = component.getTopicGoogleMapsSummary(mapsTopic());

      expect(summary).toBe(
        'no cities set · no business types set · no search center set · no radius set'
      );
    });

    it('drops empty entries from the lists', () => {
      const summary = component.getTopicGoogleMapsSummary(
        mapsTopic({ googleMapsCities: ['', 'Savannah'], googleMapsTypes: [''] })
      );

      expect(summary).toContain('Savannah');
      expect(summary).toContain('no business types set');
    });
  });

  describe('getTopicStrategySummary', () => {
    it('describes a service-buyer topic through its maps summary', () => {
      const summary = component.getTopicStrategySummary(
        topic({
          discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
          sources: [LeadDiscoverySource.GOOGLE_MAPS],
          googleMapsCities: ['Savannah'],
        })
      );

      expect(summary).toContain('Searching local buyer signals across');
      expect(summary).toContain('Savannah');
    });

    it('falls back for a service-buyer topic with no maps source', () => {
      const summary = component.getTopicStrategySummary(
        topic({
          discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
          sources: [LeadDiscoverySource.ATS],
        })
      );

      expect(summary).toBe(
        'Searching for local companies likely to buy services.'
      );
    });

    it('counts sources for any other intent', () => {
      const summary = component.getTopicStrategySummary(
        topic({ sources: [LeadDiscoverySource.ATS] })
      );

      expect(summary).toBe(
        'Searching role and project signals across 1 discovery sources.'
      );
    });
  });

  describe('getDiscoveryIntentLabel', () => {
    it('names the service-buyer intent', () => {
      expect(
        component.getDiscoveryIntentLabel(
          LeadTopicDiscoveryIntent.SERVICE_BUYERS
        )
      ).toBe('Service Buyers');
    });

    it('defaults to job openings', () => {
      expect(component.getDiscoveryIntentLabel()).toBe('Job Openings');
    });
  });

  describe('discovery status helpers', () => {
    it('has no result for an unknown topic', () => {
      expect(component.getDiscoveryResult('nope')).toBeNull();
      expect(component.isDiscoveryPending('nope')).toBe(false);
    });

    it('treats queued and running as pending', () => {
      component.discoveryResultsByTopicId = {
        a: { status: 'queued' },
        b: { status: 'running' },
        c: { status: 'completed' },
      } as never;

      expect(component.isDiscoveryPending('a')).toBe(true);
      expect(component.isDiscoveryPending('b')).toBe(true);
      expect(component.isDiscoveryPending('c')).toBe(false);
    });

    it('labels the action from the result status', () => {
      component.discoveryResultsByTopicId = {
        a: { status: 'queued' },
        b: { status: 'running' },
      } as never;

      expect(component.getDiscoveryActionLabel('a')).toBe('Queued...');
      expect(component.getDiscoveryActionLabel('b')).toBe('Running...');
    });

    it('reports the active topic as running even with no result', () => {
      component.activeTopicId = 'active-1';

      expect(component.getDiscoveryActionLabel('active-1')).toBe('Running...');
      expect(component.getDiscoveryActionLabel('other')).toBe('Run Discovery');
    });
  });

  describe('Google Maps cities', () => {
    it('commits the typed value, trimmed', () => {
      component.googleMapsCityInput = '  Savannah  ';

      component.commitGoogleMapsCity();

      expect(component.selectedGoogleMapsCities).toContain('Savannah');
      expect(component.googleMapsCityInput).toBe('');
    });

    it('commits an explicit value over the input', () => {
      component.googleMapsCityInput = 'Typed';

      component.commitGoogleMapsCity('Explicit');

      expect(component.selectedGoogleMapsCities).toContain('Explicit');
      expect(component.selectedGoogleMapsCities).not.toContain('Typed');
    });

    it('ignores a blank commit', () => {
      component.googleMapsCityInput = '   ';

      component.commitGoogleMapsCity();

      expect(component.selectedGoogleMapsCities).toEqual([]);
    });

    it('does not duplicate a city', () => {
      component.commitGoogleMapsCity('Savannah');
      component.commitGoogleMapsCity('Savannah');

      expect(
        component.selectedGoogleMapsCities.filter((c) => c === 'Savannah')
      ).toHaveLength(1);
    });

    it('removes a city', () => {
      component.commitGoogleMapsCity('Savannah');
      component.commitGoogleMapsCity('Atlanta');

      component.removeGoogleMapsCity('Savannah');

      expect(component.selectedGoogleMapsCities).toEqual(['Atlanta']);
    });

    it('applies a suggestion and clears the list', () => {
      component.googleMapsCitySuggestions = [
        { description: 'Savannah, GA' },
      ] as never;

      component.applyGoogleMapsCitySuggestion({
        description: 'Savannah, GA',
      } as never);

      expect(component.selectedGoogleMapsCities).toContain('Savannah, GA');
      expect(component.googleMapsCitySuggestions).toEqual([]);
    });

    it('commits on Enter and on comma', () => {
      component.googleMapsCityInput = 'Savannah';
      const enter = new KeyboardEvent('keydown', {
        key: 'Enter',
        cancelable: true,
      });

      component.onGoogleMapsCityInputKeydown(enter);

      expect(enter.defaultPrevented).toBe(true);
      expect(component.selectedGoogleMapsCities).toContain('Savannah');

      component.googleMapsCityInput = 'Atlanta';
      component.onGoogleMapsCityInputKeydown(
        new KeyboardEvent('keydown', { key: ',', cancelable: true })
      );
      expect(component.selectedGoogleMapsCities).toContain('Atlanta');
    });

    it('ignores other keys', () => {
      component.googleMapsCityInput = 'Savannah';

      component.onGoogleMapsCityInputKeydown(
        new KeyboardEvent('keydown', { key: 'a', cancelable: true })
      );

      expect(component.selectedGoogleMapsCities).toEqual([]);
    });
  });

  describe('Google Maps location', () => {
    it('commits and clears the location', () => {
      component.googleMapsLocationInput = '  Georgia  ';

      component.commitGoogleMapsLocation();
      expect(component.topicForm.googleMapsLocation).toBe('Georgia');

      component.clearGoogleMapsLocation();
      expect(component.topicForm.googleMapsLocation).toBe('');
      expect(component.googleMapsLocationInput).toBe('');
    });

    it('ignores a blank location commit', () => {
      component.googleMapsLocationInput = '  ';

      component.commitGoogleMapsLocation();

      expect(component.topicForm.googleMapsLocation).toBeFalsy();
    });

    it('applies a location suggestion', () => {
      component.applyGoogleMapsLocationSuggestion({
        description: 'Atlanta, GA',
      } as never);

      expect(component.topicForm.googleMapsLocation).toBe('Atlanta, GA');
      expect(component.googleMapsLocationSuggestions).toEqual([]);
    });

    it('commits on Enter only', () => {
      component.googleMapsLocationInput = 'Georgia';
      const other = new KeyboardEvent('keydown', {
        key: 'Tab',
        cancelable: true,
      });

      component.onGoogleMapsLocationInputKeydown(other);
      expect(component.topicForm.googleMapsLocation).toBeFalsy();

      component.onGoogleMapsLocationInputKeydown(
        new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
      );
      expect(component.topicForm.googleMapsLocation).toBe('Georgia');
    });
  });

  describe('location autocomplete', () => {
    it('does not search for fewer than two characters', () => {
      component.onGoogleMapsCitiesInput('a');

      expect(leadsService.searchLocations).not.toHaveBeenCalled();
      expect(component.googleMapsCitySuggestions).toEqual([]);
    });

    it('searches city suggestions once the query is long enough', () => {
      leadsService.searchLocations.mockReturnValue(
        of([{ description: 'Savannah, GA' }])
      );

      component.onGoogleMapsCitiesInput('sav');

      expect(leadsService.searchLocations).toHaveBeenCalledWith('sav');
      expect(component.googleMapsCitySuggestions).toEqual([
        { description: 'Savannah, GA' },
      ]);
    });

    it('clears city suggestions when the lookup fails', () => {
      leadsService.searchLocations.mockReturnValue(
        throwError(() => new Error('offline'))
      );

      component.onGoogleMapsCitiesInput('sav');

      expect(component.googleMapsCitySuggestions).toEqual([]);
    });

    it('searches and clears location suggestions the same way', () => {
      leadsService.searchLocations.mockReturnValue(
        of([{ description: 'Georgia' }])
      );
      component.onGoogleMapsLocationInput('geo');
      expect(component.googleMapsLocationSuggestions).toEqual([
        { description: 'Georgia' },
      ]);

      leadsService.searchLocations.mockReturnValue(
        throwError(() => new Error('offline'))
      );
      component.onGoogleMapsLocationInput('geo');
      expect(component.googleMapsLocationSuggestions).toEqual([]);

      component.onGoogleMapsLocationInput('g');
      expect(component.googleMapsLocationSuggestions).toEqual([]);
    });

    it('closes suggestions after a short delay', () => {
      jest.useFakeTimers();
      component.googleMapsCitySuggestions = [{ description: 'x' }] as never;
      component.googleMapsLocationSuggestions = [{ description: 'y' }] as never;

      component.closeGoogleMapsSuggestions('cities');
      jest.advanceTimersByTime(200);
      expect(component.googleMapsCitySuggestions).toEqual([]);
      expect(component.googleMapsLocationSuggestions).toHaveLength(1);

      component.closeGoogleMapsSuggestions('location');
      jest.advanceTimersByTime(200);
      expect(component.googleMapsLocationSuggestions).toEqual([]);
      jest.useRealTimers();
    });
  });
});
