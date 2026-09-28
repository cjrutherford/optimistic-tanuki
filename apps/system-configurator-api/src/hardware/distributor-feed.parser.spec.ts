import { parseDistributorFeed } from './distributor-feed.parser';

describe('parseDistributorFeed', () => {
  it('normalizes the documented CSV schema and preserves quoted commas and newlines', () => {
    const offers = parseDistributorFeed(
      'provider,sku,productName,unitWholesaleAmount,currency,availability,observedAt,url,hardwarePartId\r\n' +
        'CDW,ABC-1,"Server, model one",1250.50,USD,in_stock,2026-09-27T12:00:00Z,https://vendor.example/item,123e4567-e89b-42d3-a456-426614174000\r\n' +
        'Dell OEM,ABC-2,"Line one\nLine two",0,USD,unknown,2026-09-27T12:00:00-04:00,,\r\n'
    );

    expect(offers).toEqual([
      {
        vendor: 'CDW',
        sourceId: 'ABC-1',
        sourceSku: 'ABC-1',
        productName: 'Server, model one',
        amount: 1250.5,
        currency: 'USD',
        availability: 'in_stock',
        observedAt: new Date('2026-09-27T12:00:00.000Z'),
        sourceUrl: 'https://vendor.example/item',
        hardwarePartId: '123e4567-e89b-42d3-a456-426614174000',
      },
      {
        vendor: 'Dell OEM',
        sourceId: 'ABC-2',
        sourceSku: 'ABC-2',
        productName: 'Line one\nLine two',
        amount: 0,
        currency: 'USD',
        availability: 'unknown',
        observedAt: new Date('2026-09-27T16:00:00.000Z'),
      },
    ]);
  });

  it('accepts the matching JSON schema and normalizes provider aliases only by exact allowlist values', () => {
    const offers = parseDistributorFeed(
      JSON.stringify([
        {
          provider: 'Amazon Business',
          sku: 'AMZ-8',
          productName: 'Memory kit',
          unitWholesaleAmount: '89.99',
          currency: 'USD',
          availability: 'backorder',
          observedAt: '2026-09-27T08:00:00Z',
          url: 'https://business.example/AMZ-8',
          hardwarePartId: '123e4567-e89b-42d3-a456-426614174001',
        },
      ])
    );

    expect(offers[0]).toMatchObject({
      vendor: 'Amazon Business',
      sourceId: 'AMZ-8',
      sourceSku: 'AMZ-8',
      productName: 'Memory kit',
      amount: 89.99,
      sourceUrl: 'https://business.example/AMZ-8',
      hardwarePartId: '123e4567-e89b-42d3-a456-426614174001',
    });
  });

  it.each([
    [
      'unknown provider',
      { provider: 'Best Buy', sku: 'X', productName: 'GPU' },
    ],
    ['duplicate vendor SKU', { provider: 'CDW', sku: 'X', productName: 'GPU' }],
    [
      'invalid currency',
      { provider: 'CDW', sku: 'X', productName: 'GPU', currency: 'USZ' },
    ],
    [
      'invalid amount',
      {
        provider: 'CDW',
        sku: 'X',
        productName: 'GPU',
        unitWholesaleAmount: -1,
      },
    ],
    [
      'invalid timestamp',
      {
        provider: 'CDW',
        sku: 'X',
        productName: 'GPU',
        observedAt: '2026-02-30T12:00:00Z',
      },
    ],
    [
      'invalid availability',
      {
        provider: 'CDW',
        sku: 'X',
        productName: 'GPU',
        availability: 'available',
      },
    ],
  ])('rejects %s', (_caseName, override) => {
    const row = Object.assign(
      {
        provider: 'CDW',
        sku: 'BASE',
        productName: 'GPU',
        unitWholesaleAmount: 10,
        currency: 'USD',
        availability: 'in_stock',
        observedAt: '2026-09-27T12:00:00Z',
      },
      override
    );
    const content = JSON.stringify(
      _caseName === 'duplicate vendor SKU' ? [row, row] : [row]
    );

    expect(() => parseDistributorFeed(content)).toThrow();
  });

  it('rejects malformed CSV quoting and spreadsheet formula injection content', () => {
    const header =
      'provider,sku,productName,unitWholesaleAmount,currency,availability,observedAt';
    expect(() =>
      parseDistributorFeed(
        `${header}\nCDW,X,"unterminated,1,USD,in_stock,2026-09-27T12:00:00Z`
      )
    ).toThrow('CSV');

    expect(() =>
      parseDistributorFeed(
        JSON.stringify([
          {
            provider: 'CDW',
            sku: 'X',
            productName: ' =HYPERLINK("https://bad")',
            unitWholesaleAmount: 10,
            currency: 'USD',
            availability: 'in_stock',
            observedAt: '2026-09-27T12:00:00Z',
          },
        ])
      )
    ).toThrow('formula');
  });

  it('decodes doubled CSV quotes and rejects formula-like CSV cells', () => {
    const header =
      'provider,sku,productName,unitWholesaleAmount,currency,availability,observedAt';
    const offers = parseDistributorFeed(
      `${header}\nCDW,X,"Server ""Pro""",10,USD,in_stock,2026-09-27T12:00:00Z`
    );
    expect(offers[0].productName).toBe('Server "Pro"');

    expect(() =>
      parseDistributorFeed(
        `${header}\nCDW,X,"=HYPERLINK(""https://bad"")",10,USD,in_stock,2026-09-27T12:00:00Z`
      )
    ).toThrow('formula');
  });
});
