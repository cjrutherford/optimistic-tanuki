import 'reflect-metadata';
import { BillingAccountEntity } from './billing-account.entity';
import { UsageBlockGrantEntity } from './usage-block-grant.entity';
import { UsageEventEntity } from './usage-event.entity';

describe('billing data-access entities', () => {
  it('constructs a BillingAccountEntity and assigns fields', () => {
    const entity = new BillingAccountEntity();
    entity.id = 'acct-1';
    entity.tenantId = 'tenant-1';
    entity.appScope = 'billing';
    entity.profileId = 'profile-1';
    entity.name = 'Acme Corp';
    entity.status = 'active';
    entity.createdAt = new Date('2024-01-01T00:00:00Z');
    entity.updatedAt = new Date('2024-01-02T00:00:00Z');

    expect(entity.id).toBe('acct-1');
    expect(entity.tenantId).toBe('tenant-1');
    expect(entity.appScope).toBe('billing');
    expect(entity.profileId).toBe('profile-1');
    expect(entity.name).toBe('Acme Corp');
    expect(entity.status).toBe('active');
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
  });

  it('constructs a UsageBlockGrantEntity and assigns fields', () => {
    const entity = new UsageBlockGrantEntity();
    entity.id = 'grant-1';
    entity.tenantId = 'tenant-1';
    entity.appScope = 'billing';
    entity.accountId = 'acct-1';
    entity.meterId = 'meter-1';
    entity.grantedQuantity = 100;
    entity.remainingQuantity = 42;
    entity.expiresAt = null;
    entity.createdAt = new Date('2024-01-01T00:00:00Z');
    entity.updatedAt = new Date('2024-01-02T00:00:00Z');

    expect(entity.grantedQuantity).toBe(100);
    expect(entity.remainingQuantity).toBe(42);
    expect(entity.expiresAt).toBeNull();
    expect(entity.accountId).toBe('acct-1');
    expect(entity.meterId).toBe('meter-1');
  });

  it('constructs a UsageEventEntity and assigns fields', () => {
    const entity = new UsageEventEntity();
    entity.id = 'evt-1';
    entity.tenantId = 'tenant-1';
    entity.appScope = 'billing';
    entity.meterId = 'meter-1';
    entity.eventKey = 'event-key-1';
    entity.quantity = 5;
    entity.occurredAt = new Date('2024-01-01T00:00:00Z');
    entity.metadata = { source: 'test' };
    entity.createdAt = new Date('2024-01-01T00:00:00Z');
    entity.updatedAt = new Date('2024-01-02T00:00:00Z');

    expect(entity.eventKey).toBe('event-key-1');
    expect(entity.quantity).toBe(5);
    expect(entity.metadata).toEqual({ source: 'test' });
  });
});
