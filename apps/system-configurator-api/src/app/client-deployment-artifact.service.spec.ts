import { ConflictException } from '@nestjs/common';
import { CommercialQuote } from '@optimistic-tanuki/models';
import { CommercialQuoteService } from './commercial-quote.service';
import { ClientDeploymentArtifactService } from './client-deployment-artifact.service';

const quote = (overrides: Partial<CommercialQuote> = {}): CommercialQuote => ({
  id: '1d5a359d-10d4-45f5-861a-4fb1f1a8d6b1',
  sourceCost: 4000,
  currency: 'USD',
  inputs: { request: { setupHours: 16, monthlySupportHours: 2 } },
  terms: { tierId: 'tier2' },
  pricingSnapshot: {
    policyVersion: 'pass-through-v1',
    pricingModel: 'pass-through',
    hardwareCost: 4000,
    freightAmount: 99.99,
    taxAmount: 280,
    setupHours: 16,
    laborRatePerHour: 65,
    setupLabor: 1040,
    outrightPrice: 5419.99,
    monthlySupport: {
      supportHours: 2,
      laborRatePerHour: 65,
      supportLabor: 130,
      passThroughCosts: 18.5,
      monthlyTotal: 148.5,
    },
  },
  issuedAt: new Date('2026-09-27T12:00:00.000Z'),
  validUntil: new Date('2026-10-27T12:00:00.000Z'),
  version: 'pass-through-v1',
  state: 'accepted',
  idempotencyKey: 'quote-key',
  createdAt: new Date('2026-09-27T12:00:00.000Z'),
  ...overrides,
});

describe('ClientDeploymentArtifactService', () => {
  beforeEach(() =>
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-09-28T12:00:00.000Z'))
  );
  afterEach(() => jest.restoreAllMocks());
  const input = {
    quoteId: '1d5a359d-10d4-45f5-861a-4fb1f1a8d6b1',
    organization: 'HAI Client',
    contactName: 'Ada Lovelace',
    imageTag: 'sha-2850755da05286086a098d1dbdaf74f339af2a62',
    gatewayUrl: 'https://gateway.example.test',
    gatewayWsUrl: 'https://gateway.example.test',
    socketUrl: 'https://apps.example.test',
  };

  it('builds the customer proposal from the accepted server quote snapshot', async () => {
    const quoteService = {
      getQuote: jest.fn().mockResolvedValue(quote()),
    } as unknown as CommercialQuoteService;
    const service = new ClientDeploymentArtifactService(
      quoteService,
      () => new Date('2026-09-28T12:00:00.000Z')
    );

    const artifacts = await service.generate(input);

    expect(quoteService.getQuote).toHaveBeenCalledWith(input.quoteId);
    expect(artifacts['proposal.md']).toContain('$5,419.99');
    expect(artifacts['proposal.md']).toContain(
      '| Setup labor (16 hours) | $1,040.00 |'
    );
    expect(artifacts['proposal.md']).toContain('**$148.50**');
    expect(artifacts['proposal.md']).not.toMatch(/month lease/i);
    expect(artifacts['docker-compose.client.yml']).toContain(
      'cjrutherford/optimistic_tanuki_authentication:sha-2850755da05286086a098d1dbdaf74f339af2a62'
    );
  });

  it.each([
    ['an issued quote', quote({ state: 'issued' })],
    [
      'an expired accepted quote',
      quote({ validUntil: new Date('2026-09-27T00:00:00.000Z') }),
    ],
  ])('refuses to generate for %s', async (_label, invalidQuote) => {
    const quoteService = {
      getQuote: jest.fn().mockResolvedValue(invalidQuote),
    } as unknown as CommercialQuoteService;
    const service = new ClientDeploymentArtifactService(
      quoteService,
      () => new Date('2026-09-28T12:00:00.000Z')
    );

    await expect(service.generate(input)).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('does not accept prices or dates from the artifact request', async () => {
    const quoteService = {
      getQuote: jest.fn().mockResolvedValue(quote()),
    } as unknown as CommercialQuoteService;
    const service = new ClientDeploymentArtifactService(
      quoteService,
      () => new Date('2026-09-28T12:00:00.000Z')
    );

    const artifacts = await service.generate({
      ...input,
      ...({
        upfrontTotalCents: 1,
        setupLaborCents: 1,
        issuedAt: '1900-01-01T00:00:00.000Z',
        expiresAt: '2999-01-01T00:00:00.000Z',
      } as Record<string, unknown>),
    });

    expect(artifacts['proposal.md']).toContain('$5,419.99');
    expect(artifacts['proposal.md']).not.toContain('$0.01');
  });

  it('rejects quotes priced under the old markup formula', async () => {
    const quoteService = {
      getQuote: jest.fn().mockResolvedValue(
        quote({
          version: 'commercial-pricing-v1',
          pricingSnapshot: { outrightPrice: 5429.99, leases: [] },
        })
      ),
    } as unknown as CommercialQuoteService;
    const service = new ClientDeploymentArtifactService(
      quoteService,
      () => new Date('2026-09-28T12:00:00.000Z')
    );

    await expect(service.generate(input)).rejects.toThrow(
      /pass-through pricing snapshot|monthly support/
    );
  });
});
