import { getMetadataArgsStorage } from 'typeorm';
import loadDatabase from './loadDatabase';
import { validatePaymentsDispositions } from './payments-account-export-dispositions';

const registeredEntities = loadDatabase({ get: () => ({}) } as any)
  .entities as Function[];

it('covers every registered TypeORM entity, field, and relation with a disposition', () => {
  expect(registeredEntities.map((entity) => entity.name)).toEqual([
    'Donation',
    'ClassifiedPayment',
    'BusinessPage',
    'BusinessTheme',
    'CommunitySponsorship',
    'Transaction',
    'Offer',
    'SellerWallet',
    'PayoutRequest',
    'LemonSqueezyProduct',
  ]);
  expect(validatePaymentsDispositions(registeredEntities)).toEqual([]);
});

it('detects metadata and disposition drift', () => {
  const storage = getMetadataArgsStorage();
  const donation = registeredEntities[0];
  const columns = storage.columns.filter(
    (column) => column.target === donation
  );
  expect(columns.map((column) => column.propertyName)).toContain('profileId');
  const drifted = [
    {
      name: 'Donation',
      table: 'wrong_table',
      columns: ['unknown'],
      relations: [],
    },
  ];
  expect(
    validatePaymentsDispositions([donation], {
      version: 1,
      entities: drifted,
      stores: [],
      selection: {},
    })
  ).not.toEqual([]);
});
