import { DataSource } from 'typeorm';
import { ProfileAuditErasureService } from './audit-erasure.service';

describe('ProfileAuditErasureService', () => {
  it('redacts matching participation while retaining operation and timestamps', async () => {
    const queries: string[] = [];
    const dataSource = {
      getMetadata: () => ({ tableName: 'guardian_profile_activity' }),
      transaction: async (run: any) =>
        run({
          query: async (sql: string) => {
            queries.push(sql);
            if (sql.includes(' AS unsafe')) return [{ n: '1', unsafe: '0' }];
            if (sql.startsWith('SELECT count(*)')) return [{ n: '0' }];
            return [{ n: '1', ids: ['11111111-1111-4111-8111-111111111111'] }];
          },
        }),
    } as unknown as DataSource;
    const service = new ProfileAuditErasureService(dataSource);
    const result = await service.eraseParticipation({
      accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
      profileIds: [],
    });
    expect(result.allDeclaredSourcesVerified).toBe(true);
    const update = queries.find((sql) => sql.startsWith('WITH changed'))!;
    expect(update).toContain('"actorUserId" = CASE');
    expect(update).toContain('"dependentUserId" = CASE');
    expect(update).toContain('"profileId" = CASE');
    expect(update).toContain('"changedFieldNames" = \'{}\'::text[]');
    expect(update).not.toContain('"operation" =');
    expect(update).not.toContain('"createdAt" =');
  });
});
