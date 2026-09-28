import { Test, TestingModule } from '@nestjs/testing';
import { HardwareController } from './hardware.controller';
import { HardwareCatalogService } from './hardware.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import { CommercialQuoteService } from './commercial-quote.service';
import { SupplierOfferImportService } from './supplier-offer-import.service';
import { AmazonBusinessLiveSyncService } from './amazon-business-live-sync.service';
import { ClientDeploymentArtifactService } from './client-deployment-artifact.service';

describe('System Configurator HardwareController', () => {
  let module: TestingModule;
  let controller: HardwareController;
  let service: jest.Mocked<HardwareCatalogService>;
  let quoteService: jest.Mocked<CommercialQuoteService>;
  let importService: jest.Mocked<SupplierOfferImportService>;
  let amazonSyncService: { searchAndPersist: jest.Mock };
  let artifactService: { generate: jest.Mock };

  beforeEach(async () => {
    amazonSyncService = { searchAndPersist: jest.fn().mockResolvedValue([]) };
    artifactService = {
      generate: jest.fn().mockResolvedValue({ 'proposal.md': 'proposal' }),
    };
    module = await Test.createTestingModule({
      controllers: [HardwareController],
      providers: [
        {
          provide: CommercialQuoteService,
          useValue: {
            issueQuote: jest.fn().mockResolvedValue({ id: 'quote-1' }),
            getQuote: jest.fn().mockResolvedValue({ id: 'quote-1' }),
            acceptQuote: jest
              .fn()
              .mockResolvedValue({ id: 'quote-1', state: 'accepted' }),
          },
        },
        {
          provide: SupplierOfferImportService,
          useValue: {
            import: jest
              .fn()
              .mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 }),
            listRecentOffers: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AmazonBusinessLiveSyncService,
          useValue: amazonSyncService,
        },
        {
          provide: ClientDeploymentArtifactService,
          useValue: artifactService,
        },
        {
          provide: HardwareCatalogService,
          useValue: {
            getChassis: jest.fn().mockReturnValue([]),
            getChassisById: jest.fn().mockReturnValue({ id: 'xs-cloud' }),
            getCompatibleComponents: jest.fn().mockReturnValue({
              cpu: [],
              ram: [],
              storage: [],
              gpu: [],
            }),
            calculatePrice: jest.fn().mockReturnValue({ totalPrice: 2999 }),
            createOrder: jest.fn().mockReturnValue({ id: 'hai-order-1' }),
            getOrder: jest.fn().mockReturnValue({ id: 'hai-order-1' }),
            saveConfiguration: jest.fn().mockReturnValue({ id: 'cfg-1' }),
            getConfiguration: jest.fn().mockReturnValue({ id: 'cfg-1' }),
            getTiers: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get(HardwareController);
    service = module.get(HardwareCatalogService);
    quoteService = module.get(CommercialQuoteService);
    importService = module.get(SupplierOfferImportService);
  });

  it('routes message-pattern requests to the catalog service', () => {
    controller.getChassis();
    controller.getChassisById({ id: 'xs-cloud' });
    controller.getCompatibleComponents({ chassisId: 'xs-cloud' });
    controller.calculatePrice({
      chassisId: 'xs-cloud',
      chassisType: 'XS',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    });
    controller.createOrder({
      configuration: {
        chassisId: 'xs-cloud',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      shippingAddress: {
        name: 'Alex',
        street: '204 Deployment Lane',
        city: 'Savannah',
        state: 'Georgia',
        zip: '31401',
        country: 'USA',
      },
      customerEmail: 'alex@hai.example',
      paymentMethod: 'card',
    });
    controller.getOrder({ orderId: 'hai-order-1' });
    controller.saveConfiguration({
      configuration: {
        chassisId: 'xs-cloud',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      label: 'alpha',
      customerEmail: 'alex@hai.example',
    });
    controller.getConfiguration({ configurationId: 'cfg-1' });
    controller.getTiers();
    controller.listSupplierOffers();

    expect(service.getChassis).toHaveBeenCalled();
    expect(service.getChassisById).toHaveBeenCalledWith('xs-cloud');
    expect(service.getCompatibleComponents).toHaveBeenCalledWith('xs-cloud');
    expect(service.getOrder).toHaveBeenCalledWith('hai-order-1');
    expect(service.getTiers).toHaveBeenCalled();
    expect(importService.listRecentOffers).toHaveBeenCalled();
  });

  it('exposes the shared hardware command contract', () => {
    expect(HardwareCommands.GET_CHASSIS).toContain(
      'system-configurator.hardware'
    );
  });

  it('routes typed operator requests to import and quote services', async () => {
    const payload = { provider: 'CDW', format: 'json', content: '[]' } as const;
    const quoteRequest = {
      tierId: 'tier1',
      items: [{ offerId: 'offer-1', quantity: 1 }],
      monthlyRetainerRevenue: 500,
      monthlyCloudCost: 50,
      monthlySmsCost: 10,
      monthlyNetworkCost: 10,
      idempotencyKey: 'quote-1',
    };

    await controller.importSupplierOffers(payload as any);
    await controller.issueCommercialQuote(quoteRequest);
    await controller.getCommercialQuote({ quoteId: 'quote-uuid' });
    await controller.acceptCommercialQuote({ quoteId: 'quote-uuid' });
    expect(controller.probeOperatorAccess()).toEqual({
      available: true,
      service: 'system-configurator',
    });

    expect(HardwareCommands.IMPORT_SUPPLIER_OFFERS).toBe(
      'system-configurator.hardware.importSupplierOffers'
    );
    expect(HardwareCommands.LIST_SUPPLIER_OFFERS).toBe(
      'system-configurator.hardware.listSupplierOffers'
    );
    expect(HardwareCommands.ISSUE_COMMERCIAL_QUOTE).toContain(
      'issueCommercialQuote'
    );
    expect(HardwareCommands.GET_COMMERCIAL_QUOTE).toContain(
      'getCommercialQuote'
    );
    expect(HardwareCommands.ACCEPT_COMMERCIAL_QUOTE).toContain(
      'acceptCommercialQuote'
    );
    expect(HardwareCommands.PROBE_OPERATOR_ACCESS).toContain(
      'probeOperatorAccess'
    );
    expect(importService.import).toHaveBeenCalledWith(payload);
    expect(quoteService.issueQuote).toHaveBeenCalledWith(quoteRequest);
    expect(quoteService.getQuote).toHaveBeenCalledWith('quote-uuid');
    expect(quoteService.acceptQuote).toHaveBeenCalledWith('quote-uuid');
  });

  it('routes Amazon Business search and accepted quote artifact commands to their services', async () => {
    const search = {
      keywords: 'edge workstation',
      shippingPostalCode: '31401',
    };
    const deployment = {
      quoteId: '1d5a359d-10d4-45f5-861a-4fb1f1a8d6b1',
      organization: 'HAI Client',
      contactName: 'Ada Lovelace',
      imageTag: 'build-123',
      gatewayUrl: 'https://gateway.example.test',
      gatewayWsUrl: 'https://gateway.example.test',
      socketUrl: 'https://apps.example.test',
    };

    await controller.searchAmazonBusinessOffers(search as any);
    await controller.generateClientDeploymentArtifacts(deployment as any);

    expect(amazonSyncService.searchAndPersist).toHaveBeenCalledWith(search);
    expect(artifactService.generate).toHaveBeenCalledWith(deployment);
    expect(HardwareCommands.SEARCH_AMAZON_BUSINESS_OFFERS).toContain(
      'searchAmazon'
    );
    expect(HardwareCommands.GENERATE_CLIENT_DEPLOYMENT_ARTIFACTS).toContain(
      'generateClientDeploymentArtifacts'
    );
  });
});
