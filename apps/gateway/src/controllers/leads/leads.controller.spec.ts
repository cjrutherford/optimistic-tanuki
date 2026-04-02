import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  LeadAnalysisCommands,
  LeadCommands,
  LeadFlagCommands,
  LeadOnboardingCommands,
  LeadTopicCommands,
} from '@optimistic-tanuki/constants';
import { LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';

describe('LeadsController', () => {
  let controller: LeadsController;
  let leadClient: jest.Mocked<ClientProxy>;

  const mockUser = {
    userId: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    profileId: 'profile-1',
    scopes: [],
    roles: [],
  };
  const appScope = 'leads-app';

  beforeEach(async () => {
    const mockClient = {
      send: jest.fn(),
    };

    const moduleRef = Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: 'LEAD_SERVICE',
          useValue: mockClient,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleRef.compile();

    controller = module.get<LeadsController>(LeadsController);
    leadClient = module.get('LEAD_SERVICE');
  });

  it('proxies lead list requests with auth context', async () => {
    leadClient.send.mockReturnValue(of([]));

    await controller.findAll(mockUser as any, appScope, 'new', 'upwork');

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.FIND_ALL },
      {
        status: 'new',
        source: 'upwork',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'leads-app',
      }
    );
  });

  it('proxies lead creation with shared command constants and context', async () => {
    leadClient.send.mockReturnValue(of({ id: 'lead-1' }));

    await controller.create(mockUser as any, appScope, {
      name: 'New Lead',
      source: LeadSource.REFERRAL,
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      {
        dto: {
          name: 'New Lead',
          source: LeadSource.REFERRAL,
        },
        context: {
          userId: 'user-1',
          profileId: 'profile-1',
          appScope: 'leads-app',
        },
      }
    );
  });

  it('proxies topic creation with scoped context', async () => {
    leadClient.send.mockReturnValue(of({ id: 'topic-1' }));

    await controller.createTopic(mockUser as any, appScope, {
      name: 'Cloud',
      description: '',
      keywords: ['aws'],
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadTopicCommands.CREATE },
      {
        dto: {
          name: 'Cloud',
          description: '',
          keywords: ['aws'],
        },
        context: {
          userId: 'user-1',
          profileId: 'profile-1',
          appScope: 'leads-app',
        },
      }
    );
  });

  it('uses exported onboarding command constants', async () => {
    leadClient.send.mockReturnValue(
      of({
        suggestedServiceOffer: 'React modernization consulting',
      })
    );

    await controller.analyzeMadLib({
      text: 'I modernize React codebases.',
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadOnboardingCommands.ANALYZE_MAD_LIB },
      { text: 'I modernize React codebases.' }
    );
  });

  it('proxies onboarding confirmation with context', async () => {
    leadClient.send.mockReturnValue(of({ topics: [] }));

    await controller.confirmOnboarding(mockUser as any, appScope, {
      profile: {
        currentStep: 4,
      } as any,
      topics: [],
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadOnboardingCommands.CONFIRM },
      {
        profile: {
          currentStep: 4,
        },
        topics: [],
        context: {
          userId: 'user-1',
          profileId: 'profile-1',
          appScope: 'leads-app',
        },
      }
    );
  });

  it('proxies location autocomplete with exported constants', async () => {
    leadClient.send.mockReturnValue(of([]));

    await controller.autocompleteLocations('sav');

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadOnboardingCommands.AUTOCOMPLETE_LOCATIONS },
      { query: 'sav' }
    );
  });

  it('proxies lead flags with scoped context', async () => {
    leadClient.send.mockReturnValue(of([]));

    await controller.findFlagsByLead(mockUser as any, appScope, 'lead-1');

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadFlagCommands.FIND_BY_LEAD },
      {
        leadId: 'lead-1',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'leads-app',
      }
    );
  });

  it('proxies analysis runs with the exported analysis command', async () => {
    leadClient.send.mockReturnValue(of({}));

    await controller.runLeadAnalysis(mockUser as any, appScope, {
      leadId: 'lead-1',
      topicId: 'topic-1',
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadAnalysisCommands.RUN },
      {
        leadId: 'lead-1',
        topicId: 'topic-1',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'leads-app',
      }
    );
  });
});
