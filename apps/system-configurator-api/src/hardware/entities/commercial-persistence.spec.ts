import { getMetadataArgsStorage } from 'typeorm';
import { SupplierOfferEntity } from './supplier-offer.entity';
import { CommercialQuoteEntity } from './commercial-quote.entity';

describe('commercial persistence entities', () => {
  it('limits normalized supplier offers to approved vendors and indexed source observations', () => {
    const storage = getMetadataArgsStorage();
    const offerChecks = storage.checks
      .filter((check) => check.target === SupplierOfferEntity)
      .map((check) => check.expression);
    const offerIndices = storage.indices.filter(
      (index) => index.target === SupplierOfferEntity
    );

    expect(offerChecks.join(' ')).toContain('CDW');
    expect(offerChecks.join(' ')).toContain('Newegg Business');
    expect(offerChecks.join(' ')).toContain('Amazon Business');
    expect(offerChecks.join(' ')).toContain('Dell OEM');
    expect(offerIndices.some((index) => index.unique)).toBe(true);
    expect(offerIndices.some((index) => index.columns?.length)).toBe(true);
  });

  it('stores quote snapshots with unique idempotency and no update timestamp', () => {
    const storage = getMetadataArgsStorage();
    const quoteColumns = storage.columns.filter(
      (column) => column.target === CommercialQuoteEntity
    );
    const quoteIndices = storage.indices.filter(
      (index) => index.target === CommercialQuoteEntity
    );
    const columnNames = quoteColumns.map((column) => column.propertyName);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        'sourceCost',
        'inputs',
        'terms',
        'pricingSnapshot',
        'issuedAt',
        'validUntil',
        'version',
        'state',
        'idempotencyKey',
      ])
    );
    expect(columnNames).not.toContain('updatedAt');
    expect(
      quoteColumns
        .filter((column) =>
          [
            'sourceCost',
            'inputs',
            'terms',
            'pricingSnapshot',
            'issuedAt',
            'validUntil',
            'version',
            'idempotencyKey',
          ].includes(column.propertyName)
        )
        .every((column) => column.options.update === false)
    ).toBe(true);
    expect(quoteIndices.some((index) => index.unique)).toBe(true);
  });
});
