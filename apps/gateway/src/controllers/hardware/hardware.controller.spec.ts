import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  HardwareController,
  OwnerConsoleScopeGuard,
} from './hardware.controller';
import {
  HardwareCommands,
  LeadCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { ForbiddenException } from '@nestjs/common';

describe('HardwareController', () => {
  let controller: HardwareController;
  let client: jest.Mocked<ClientProxy>;
  let leadClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HardwareController],
      providers: [
        {
          provide: ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({})),
          },
        },
        {
          provide: ServiceTokens.LEAD_SERVICE,
          useValue: { send: jest.fn().mockReturnValue(of({ id: 'lead-1' })) },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnerConsoleScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(HardwareController);
    client = module.get(ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE);
    leadClient = module.get(ServiceTokens.LEAD_SERVICE);
  });

  it('proxies chassis list requests to the system configurator service', async () => {
    await controller.getChassis();

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_CHASSIS },
      {}
    );
  });

  it('proxies chassis lookups by id', async () => {
    await controller.getChassisById('xs-cloud');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_CHASSIS_BY_ID },
      { id: 'xs-cloud' }
    );
  });

  it('proxies compatible component lookups', async () => {
    await controller.getCompatibleComponents('xs-cloud');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS },
      { chassisId: 'xs-cloud' }
    );
  });

  it('proxies price calculations', async () => {
    const configuration = {
      chassisId: 'hai-edge-xs',
      chassisType: 'XS',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    };

    await controller.calculatePrice(configuration);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.CALCULATE_PRICE },
      configuration
    );
  });

  it('proxies order creation including payment method', async () => {
    const payload = {
      configuration: {
        chassisId: 'hai-edge-xs',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      shippingAddress: {
        name: 'Alex Integrator',
        street: '204 Deployment Lane',
        city: 'Savannah',
        state: 'Georgia',
        zip: '31401',
        country: 'USA',
      },
      customerEmail: 'alex@hai.example',
      paymentMethod: 'zelle' as const,
    };

    await controller.createOrder(payload);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.CREATE_ORDER },
      payload
    );
  });

  it('proxies order lookups for confirmation pages', async () => {
    await controller.getOrder('hai-order-1');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_ORDER },
      { orderId: 'hai-order-1' }
    );
  });

  it('omits all firm pricing fields from public tiers while preserving descriptions', async () => {
    const tiers = [
      {
        id: 'tier1',
        name: 'Compact Edge Appliance',
        description: 'A compact appliance for small deployments.',
        retailPrice: 705,
        retailPriceMax: 850,
        leaseMonthlyRate: 99,
        monthlyLeasePayment: 123,
        sourceCost: 540,
        wholesaleCost: 522.22,
        marginRate: 0.35,
        marginAmount: 182.78,
        pricingDetails: {
          wholesalePrice: 510,
          monthlyCloudCost: 12,
          contingencyReserve: 54,
        },
        purchaseCost: 500,
        procurement: { supplier: 'Internal Supplier' },
      },
    ];
    client.send.mockReturnValueOnce(of(tiers) as any);

    const publicTiers = await controller.getTiers();
    expect(publicTiers).toEqual([
      {
        id: 'tier1',
        name: 'Compact Edge Appliance',
        description: 'A compact appliance for small deployments.',
      },
    ]);
    expect(JSON.stringify(publicTiers)).not.toMatch(
      /retailPrice|leaseMonthlyRate|monthlyLeasePayment|sourceCost|wholesale|margin|purchaseCost|contingencyReserve/i
    );
  });

  it('proxies operator feed and quote requests to their typed TCP commands', async () => {
    const feed = { provider: 'CDW', format: 'json', content: '[]' };
    const quote = {
      tierId: 'tier1',
      items: [{ offerId: 'offer-1', quantity: 1 }],
      monthlyRetainerRevenue: 500,
      monthlyCloudCost: 40,
      monthlySmsCost: 10,
      monthlyNetworkCost: 10,
      idempotencyKey: 'key-1',
    };
    const amazonSearch = {
      keywords: 'compact workstation',
      shippingPostalCode: '31401',
    };

    await controller.listSupplierOffers();
    await controller.searchAmazonBusinessOffers(amazonSearch);
    await controller.importSupplierOffers(feed as any);
    await controller.issueCommercialQuote(quote as any);
    await controller.getCommercialQuote('quote-1');
    await controller.acceptCommercialQuote('quote-1');
    await controller.probeOperatorAccess();

    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: HardwareCommands.LIST_SUPPLIER_OFFERS },
      {}
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: HardwareCommands.SEARCH_AMAZON_BUSINESS_OFFERS },
      amazonSearch
    );
    expect(client.send).toHaveBeenNthCalledWith(
      3,
      { cmd: HardwareCommands.IMPORT_SUPPLIER_OFFERS },
      feed
    );
    expect(client.send).toHaveBeenNthCalledWith(
      4,
      { cmd: HardwareCommands.ISSUE_COMMERCIAL_QUOTE },
      quote
    );
    expect(client.send).toHaveBeenNthCalledWith(
      5,
      { cmd: HardwareCommands.GET_COMMERCIAL_QUOTE },
      { quoteId: 'quote-1' }
    );
    expect(client.send).toHaveBeenNthCalledWith(
      6,
      { cmd: HardwareCommands.ACCEPT_COMMERCIAL_QUOTE },
      { quoteId: 'quote-1' }
    );
    expect(client.send).toHaveBeenNthCalledWith(
      7,
      { cmd: HardwareCommands.PROBE_OPERATOR_ACCESS },
      {}
    );
  });

  it('generates deployment artifacts using the quote ID from the path', async () => {
    const artifactBody = {
      quoteId: '11111111-1111-4111-8111-111111111111',
      organization: 'Hopeful Aspirations Industries',
      contactName: 'Alex Owner',
      imageTag: '2026.09.28',
      gatewayUrl: 'https://gateway.example.test',
      gatewayWsUrl: 'wss://gateway.example.test',
      socketUrl: 'https://gateway.example.test/socket.io',
    };
    const artifacts = {
      'docker-compose.client.yml': 'services: {}',
      '.env': 'JWT_SECRET=private-value',
      'gateway-config.yaml': 'services: []',
      'gateway-composition.yaml': 'services: []',
      'bootstrap-owner.mjs': 'console.log("owner bootstrap")',
      'proposal.md': '# Proposal',
    };
    const response = {
      setHeader: jest.fn(),
      send: jest.fn((body: Buffer) => body),
    };
    client.send.mockReturnValueOnce(of(artifacts) as any);

    await controller.generateClientDeploymentArtifacts(
      '22222222-2222-4222-8222-222222222222',
      artifactBody as any,
      response as any
    );

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GENERATE_CLIENT_DEPLOYMENT_ARTIFACTS },
      {
        quoteId: '22222222-2222-4222-8222-222222222222',
        organization: 'Hopeful Aspirations Industries',
        contactName: 'Alex Owner',
        imageTag: '2026.09.28',
        gatewayUrl: 'https://gateway.example.test',
        gatewayWsUrl: 'wss://gateway.example.test',
        socketUrl: 'https://gateway.example.test/socket.io',
      }
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/gzip'
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="hai-computer-22222222-2222-4222-8222-222222222222.tar.gz"'
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, private'
    );
    const archive = response.send.mock.calls[0][0];
    expect(archive.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
  });

  it('commits an accepted, unexpired quote from its server snapshot and ignores client pricing fields', async () => {
    const quote = {
      id: 'quote-1',
      sourceCost: 4000,
      currency: 'USD',
      inputs: {
        request: {
          tierId: 'tier2',
          monthlyRetainerRevenue: 500,
          monthlyCloudCost: 40,
        },
      },
      terms: {
        tierId: 'tier2',
        issuedAt: '2026-09-20T00:00:00.000Z',
        validUntil: '2026-10-20T00:00:00.000Z',
      },
      pricingSnapshot: {
        outrightPrice: 5832,
        contingencyReserve: 400,
        sourceWholesaleCost: 4000,
        procurementMarkup: 1512,
      },
      validUntil: new Date(Date.now() + 60_000),
      state: 'accepted',
      version: 'v1',
    };
    client.send.mockReturnValueOnce(of(quote) as any);
    const body = {
      customerName: '  Customer Name  ',
      customerEmail: 'customer@example.com',
      customerPhone: '555-0100',
      total: 1,
      tier: 'tier1',
      currency: 'BAD',
      terms: { sourceCost: 1 },
      idempotencyKey: 'caller-controlled',
      context: {
        userId: 'attacker',
        profileId: 'attacker',
        appScope: 'global',
      },
    };

    await controller.commitHardwareProposal('quote-1', body, {
      headers: { 'x-ot-appscope': 'owner-console' },
      user: { userId: 'owner-user', profileId: 'owner-profile' },
    } as any);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_COMMERCIAL_QUOTE },
      { quoteId: 'quote-1' }
    );
    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.COMMIT_HARDWARE_PROPOSAL },
      {
        context: {
          userId: 'owner-user',
          profileId: 'owner-profile',
          appScope: 'owner-console',
          ownerConsoleAccess: true,
        },
        proposal: {
          quoteId: 'quote-1',
          customerName: 'Customer Name',
          customerEmail: 'customer@example.com',
          customerPhone: '555-0100',
          tier: 'tier2',
          total: 5832,
          currency: 'USD',
          terms: {
            tierId: 'tier2',
            quoteVersion: 'v1',
            issuedAt: '2026-09-20T00:00:00.000Z',
            validUntil: '2026-10-20T00:00:00.000Z',
            hardwarePrice: 5832,
            monthlyRetainerRevenue: 500,
          },
          idempotencyKey: 'hardware-proposal-quote:quote-1',
        },
      }
    );
    const downstreamPayload = (leadClient.send as jest.Mock).mock.calls[0][1];
    expect(JSON.stringify(downstreamPayload)).not.toMatch(
      /sourceCost|wholesale|contingencyReserve|procurementMarkup/i
    );
  });

  it('rejects a missing or incomplete verified owner context before fetching a quote', async () => {
    await expect(
      controller.commitHardwareProposal(
        'quote-1',
        { customerName: 'Customer' },
        {} as any
      )
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.commitHardwareProposal(
        'quote-1',
        { customerName: 'Customer' },
        {
          headers: { 'x-ot-appscope': 'owner-console' },
          user: { userId: 'owner-user' },
        } as any
      )
    ).rejects.toThrow(ForbiddenException);
    expect(client.send).not.toHaveBeenCalled();
    expect(leadClient.send).not.toHaveBeenCalled();
  });

  it('rejects a returned quote whose id does not match the requested quote', async () => {
    client.send.mockReturnValueOnce(
      of({ id: 'different-quote', state: 'accepted' }) as any
    );
    await expect(
      controller.commitHardwareProposal(
        'quote-1',
        { customerName: 'Customer' },
        {
          headers: { 'x-ot-appscope': 'owner-console' },
          user: { userId: 'owner-user', profileId: 'owner-profile' },
        } as any
      )
    ).rejects.toThrow('The requested quote could not be verified.');
    expect(leadClient.send).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed address', 'customer@@example.com'],
    [
      'address with header injection',
      `customer@example.com${String.fromCharCode(
        13,
        10
      )}Bcc:attacker@example.com`,
    ],
    ['overlong address', `${'a'.repeat(245)}@example.com`],
  ])(
    'rejects a %s before committing a proposal',
    async (_description, customerEmail) => {
      await expect(
        controller.commitHardwareProposal(
          'quote-1',
          {
            customerName: 'Customer',
            customerEmail,
          },
          {
            headers: { 'x-ot-appscope': 'owner-console' },
            user: { userId: 'owner-user', profileId: 'owner-profile' },
          } as any
        )
      ).rejects.toThrow('A valid customer email is required');
      expect(client.send).not.toHaveBeenCalled();
      expect(leadClient.send).not.toHaveBeenCalled();
    }
  );

  it('rejects a customer phone containing control characters or excessive length', async () => {
    await expect(
      controller.commitHardwareProposal(
        'quote-1',
        {
          customerName: 'Customer',
          customerPhone: `555${String.fromCharCode(10)}0100`,
        },
        {
          headers: { 'x-ot-appscope': 'owner-console' },
          user: { userId: 'owner-user', profileId: 'owner-profile' },
        } as any
      )
    ).rejects.toThrow('Customer phone must be 50 characters or fewer');
    await expect(
      controller.commitHardwareProposal(
        'quote-1',
        {
          customerName: 'Customer',
          customerPhone: '1'.repeat(51),
        },
        {
          headers: { 'x-ot-appscope': 'owner-console' },
          user: { userId: 'owner-user', profileId: 'owner-profile' },
        } as any
      )
    ).rejects.toThrow('Customer phone must be 50 characters or fewer');
    expect(client.send).not.toHaveBeenCalled();
    expect(leadClient.send).not.toHaveBeenCalled();
  });

  it.each([
    ['issued', new Date(Date.now() + 60_000)],
    ['accepted', new Date(Date.now() - 60_000)],
    ['expired', new Date(Date.now() + 60_000)],
  ])(
    'rejects a %s or expired quote before committing it',
    async (state, validUntil) => {
      client.send.mockReturnValueOnce(
        of({ id: 'quote-1', state, validUntil }) as any
      );
      await expect(
        controller.commitHardwareProposal(
          'quote-1',
          { customerName: 'Customer' },
          {
            headers: { 'x-ot-appscope': 'owner-console' },
            user: { userId: 'owner-user', profileId: 'owner-profile' },
          } as any
        )
      ).rejects.toThrow();
      expect(leadClient.send).not.toHaveBeenCalled();
    }
  );

  it('uses the same quote-derived idempotency key on retries', async () => {
    const quote = {
      id: 'quote-retry',
      currency: 'USD',
      inputs: { request: { tierId: 'tier1', monthlyRetainerRevenue: 100 } },
      terms: { tierId: 'tier1' },
      pricingSnapshot: { outrightPrice: 1000 },
      validUntil: new Date(Date.now() + 60_000),
      state: 'accepted',
      version: 'v1',
    };
    client.send.mockReturnValue(of(quote) as any);
    const request = {
      headers: { 'x-ot-appscope': 'owner-console' },
      user: { userId: 'owner-user', profileId: 'owner-profile' },
    } as any;
    await controller.commitHardwareProposal(
      'quote-retry',
      { customerName: 'Customer' },
      request
    );
    await controller.commitHardwareProposal(
      'quote-retry',
      { customerName: 'Customer' },
      request
    );
    const payloads = (leadClient.send as jest.Mock).mock.calls.map(
      (call) => call[1]
    );
    expect(payloads[0].proposal.idempotencyKey).toBe(
      'hardware-proposal-quote:quote-retry'
    );
    expect(payloads[1].proposal.idempotencyKey).toBe(
      payloads[0].proposal.idempotencyKey
    );
  });

  it('requires authentication and owner-console scope on every operator route', () => {
    for (const handler of [
      HardwareController.prototype.importSupplierOffers,
      HardwareController.prototype.listSupplierOffers,
      HardwareController.prototype.searchAmazonBusinessOffers,
      HardwareController.prototype.issueCommercialQuote,
      HardwareController.prototype.getCommercialQuote,
      HardwareController.prototype.acceptCommercialQuote,
      HardwareController.prototype.generateClientDeploymentArtifacts,
      HardwareController.prototype.commitHardwareProposal,
      HardwareController.prototype.probeOperatorAccess,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
        expect.arrayContaining([AuthGuard, OwnerConsoleScopeGuard])
      );
    }
  });

  it('rejects missing, alternate, and caller supplied role scopes', () => {
    const guard = new OwnerConsoleScopeGuard();
    const context = (scope?: string, body?: unknown) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-ot-appscope': scope }, body }),
        }),
      } as any);

    expect(guard.canActivate(context('owner-console', { role: 'owner' }))).toBe(
      true
    );
    expect(() =>
      guard.canActivate(context(undefined, { role: 'owner' }))
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(context('global', { role: 'owner' }))
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(context('public', { role: 'owner' }))
    ).toThrow(ForbiddenException);
  });
});
