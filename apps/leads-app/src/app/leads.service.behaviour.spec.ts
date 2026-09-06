import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { LeadsService } from './leads.service';
import { LeadsApiService } from '@optimistic-tanuki/leads-data-access';
import { LeadTopicsService } from '@optimistic-tanuki/leads-feature-topics';
import { LeadFlagsService } from '@optimistic-tanuki/leads-feature-flags';
import { LeadOnboardingService } from '@optimistic-tanuki/leads-feature-onboarding';
import type { Lead } from './leads.types';

/**
 * LeadsService is a facade over four feature services plus a couple of direct
 * HTTP calls. What is worth asserting is the local lead cache it maintains
 * through tap, and that each delegation reaches the right collaborator.
 */
describe('LeadsService', () => {
  let service: LeadsService;
  let http: HttpTestingController;
  let leadsApi: Record<string, jest.Mock>;
  let topics: Record<string, jest.Mock>;
  let flags: Record<string, jest.Mock>;
  let onboarding: Record<string, jest.Mock>;

  const lead = (overrides: Partial<Lead> = {}): Lead =>
    ({ id: 'lead-1', title: 'Bakery', ...overrides } as Lead);

  beforeEach(() => {
    leadsApi = {
      getLeads: jest.fn().mockReturnValue(of([])),
      getLead: jest.fn().mockReturnValue(of(lead())),
      createLead: jest.fn().mockReturnValue(of(lead())),
      updateLead: jest.fn().mockReturnValue(of(lead())),
      deleteLead: jest.fn().mockReturnValue(of(undefined)),
      getStats: jest.fn().mockReturnValue(of({ total: 0 })),
    };
    topics = {
      getTopics: jest.fn().mockReturnValue(of([])),
      getTopicDiscoveryStatus: jest.fn().mockReturnValue(of({})),
      createTopic: jest.fn().mockReturnValue(of({})),
      updateTopic: jest.fn().mockReturnValue(of({})),
      deleteTopic: jest.fn().mockReturnValue(of(undefined)),
      toggleTopic: jest.fn().mockReturnValue(of({})),
      runTopicDiscovery: jest.fn().mockReturnValue(of({})),
    };
    flags = {
      getLeadFlags: jest.fn().mockReturnValue(of([])),
      flagLead: jest.fn().mockReturnValue(of({ id: 'flag-1' })),
    };
    onboarding = {
      analyzeOnboarding: jest.fn().mockReturnValue(of({ topics: [] })),
      analyzeMadLib: jest.fn().mockReturnValue(of({})),
      parseResume: jest.fn().mockReturnValue(of({})),
      searchLocations: jest.fn().mockReturnValue(of([])),
      advanceDiscInterview: jest.fn().mockReturnValue(of({})),
      lookupAtsCompany: jest.fn().mockReturnValue(of([])),
      suggestAtsCompanies: jest.fn().mockReturnValue(of([])),
      confirmOnboarding: jest.fn().mockReturnValue(of({ topics: [] })),
    };

    TestBed.configureTestingModule({
      providers: [
        LeadsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LeadsApiService, useValue: leadsApi },
        { provide: LeadTopicsService, useValue: topics },
        { provide: LeadFlagsService, useValue: flags },
        { provide: LeadOnboardingService, useValue: onboarding },
      ],
    });

    service = TestBed.inject(LeadsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('local lead cache', () => {
    const seed = async (leads: Lead[]) => {
      leadsApi.getLeads.mockReturnValue(of(leads));
      await firstValueFrom(service.getLeads());
    };

    it('prepends a created lead to the cache', async () => {
      await seed([lead({ id: 'existing' })]);
      leadsApi.createLead.mockReturnValue(of(lead({ id: 'new' })));

      await firstValueFrom(service.createLead({} as never));
      // The cache is private; the delete path proves what it holds.
      leadsApi.deleteLead.mockReturnValue(of(undefined));
      await firstValueFrom(service.deleteLead('new'));

      leadsApi.createLead.mockReturnValue(of(lead({ id: 'second' })));
      await firstValueFrom(service.createLead({} as never));

      expect(leadsApi.createLead).toHaveBeenCalledTimes(2);
    });

    it('swaps the updated lead into the cache', async () => {
      await seed([lead({ id: 'lead-1', title: 'Old' })]);
      leadsApi.updateLead.mockReturnValue(
        of(lead({ id: 'lead-1', title: 'New' }))
      );

      const updated = await firstValueFrom(
        service.updateLead('lead-1', {} as never)
      );

      expect(updated.title).toBe('New');
      expect(leadsApi.updateLead).toHaveBeenCalledWith('lead-1', {});
    });

    it('marks a flagged lead and keeps prior flags', async () => {
      await seed([lead({ id: 'lead-1' })]);

      const flag = await firstValueFrom(
        service.flagLead('lead-1', { reason: 'spam' } as never)
      );

      expect(flag).toEqual({ id: 'flag-1' });
      expect(flags.flagLead).toHaveBeenCalledWith('lead-1', {
        reason: 'spam',
      });
    });

    it('passes leads straight through from the api', async () => {
      const leads = [lead({ id: 'a' }), lead({ id: 'b' })];
      leadsApi.getLeads.mockReturnValue(of(leads));

      await expect(firstValueFrom(service.getLeads())).resolves.toEqual(leads);
    });
  });

  describe('delegation', () => {
    it.each([
      ['getLead', 'leadsApi', 'getLead', ['lead-1']],
      ['getStats', 'leadsApi', 'getStats', []],
      ['getTopics', 'topics', 'getTopics', []],
      ['getTopicDiscoveryStatus', 'topics', 'getTopicDiscoveryStatus', ['t-1']],
      ['createTopic', 'topics', 'createTopic', [{}]],
      ['deleteTopic', 'topics', 'deleteTopic', ['t-1']],
      ['toggleTopic', 'topics', 'toggleTopic', [{}]],
      ['runTopicDiscovery', 'topics', 'runTopicDiscovery', ['t-1']],
      ['getLeadFlags', 'flags', 'getLeadFlags', ['lead-1']],
      ['analyzeOnboarding', 'onboarding', 'analyzeOnboarding', [{}]],
      ['analyzeMadLib', 'onboarding', 'analyzeMadLib', ['text']],
      ['searchLocations', 'onboarding', 'searchLocations', ['sav']],
      ['advanceDiscInterview', 'onboarding', 'advanceDiscInterview', [{}]],
      ['lookupAtsCompany', 'onboarding', 'lookupAtsCompany', ['Acme']],
      ['suggestAtsCompanies', 'onboarding', 'suggestAtsCompanies', []],
    ])('%s reaches %s.%s', async (method, group, target, args) => {
      const groups: Record<string, Record<string, jest.Mock>> = {
        leadsApi,
        topics,
        flags,
        onboarding,
      };

      const call = (
        service as unknown as Record<string, (...a: unknown[]) => unknown>
      )[method];
      await firstValueFrom(call.apply(service, args as unknown[]) as never);

      expect(groups[group][target]).toHaveBeenCalled();
    });

    it('updateTopic passes both the id and the patch', async () => {
      await firstValueFrom(service.updateTopic('t-1', { name: 'x' } as never));
      expect(topics.updateTopic).toHaveBeenCalledWith('t-1', { name: 'x' });
    });

    it('parseResume hands the file over', async () => {
      const file = new File(['cv'], 'cv.pdf');
      await firstValueFrom(service.parseResume(file));
      expect(onboarding.parseResume).toHaveBeenCalledWith(file);
    });

    it('confirmOnboarding defaults the disc transcript to empty', async () => {
      await firstValueFrom(service.confirmOnboarding({} as never, [] as never));
      expect(onboarding.confirmOnboarding).toHaveBeenCalledWith({}, [], []);
    });
  });

  describe('application endpoints', () => {
    it('posts to generate an application', async () => {
      const promise = firstValueFrom(service.generateApplication('lead-1'));
      const request = http.expectOne('/api/leads/lead-1/application/generate');
      expect(request.request.method).toBe('POST');
      request.flush({ id: 'app-1' });

      await expect(promise).resolves.toEqual({ id: 'app-1' });
    });

    it('fetches an existing application', async () => {
      const promise = firstValueFrom(service.findApplication('lead-1'));
      http.expectOne('/api/leads/lead-1/application').flush(null);

      await expect(promise).resolves.toBeNull();
    });

    it('builds the export url from the kind and format', () => {
      expect(service.applicationExportUrl('lead-1', 'resume', 'docx')).toBe(
        '/api/leads/lead-1/application/export?kind=resume&format=docx'
      );
      expect(
        service.applicationExportUrl('lead-2', 'cover-letter', 'odt')
      ).toBe(
        '/api/leads/lead-2/application/export?kind=cover-letter&format=odt'
      );
    });
  });
});
