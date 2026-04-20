import { Initial1737000000000 } from '../../migrations/1737000000000-initial';

describe('finance initial migration', () => {
  it('uses uuid account references for finance records', async () => {
    const migration = new Initial1737000000000();
    const executedQueries: string[] = [];

    await migration.up({
      query: async (sql: string) => {
        executedQueries.push(sql);
      },
    } as any);

    const transactionTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "transaction"')
    );
    const recurringItemTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "recurring_item"')
    );

    expect(transactionTableSql).toContain('"accountId" uuid NOT NULL');
    expect(recurringItemTableSql).toContain('"accountId" uuid');
  });

  it('creates tenant tables and tenant foreign keys while preserving legacy scope columns', async () => {
    const migration = new Initial1737000000000();
    const executedQueries: string[] = [];

    await migration.up({
      query: async (sql: string) => {
        executedQueries.push(sql);
      },
    } as any);

    const tenantTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "finance_tenant"')
    );
    const tenantMemberTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "finance_tenant_member"')
    );
    const accountTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "account"')
    );
    const transactionTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "transaction"')
    );
    const inventoryTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "inventory_item"')
    );
    const budgetTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "budget"')
    );
    const recurringItemTableSql = executedQueries.find((sql) =>
      sql.includes('CREATE TABLE "recurring_item"')
    );
    const tenantAccountFkSql = executedQueries.find((sql) =>
      sql.includes('FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id")')
    );

    expect(tenantTableSql).toContain(
      '"id" uuid NOT NULL DEFAULT uuid_generate_v4()'
    );
    expect(tenantTableSql).toContain('"profileId" character varying NOT NULL');
    expect(tenantTableSql).toContain(
      '"appScope" character varying NOT NULL DEFAULT \'finance\''
    );

    expect(tenantMemberTableSql).toContain('"tenantId" uuid NOT NULL');
    expect(tenantMemberTableSql).toContain(
      '"profileId" character varying NOT NULL'
    );
    expect(tenantMemberTableSql).toContain('"role" character varying NOT NULL');

    for (const tableSql of [
      accountTableSql,
      transactionTableSql,
      inventoryTableSql,
      budgetTableSql,
      recurringItemTableSql,
    ]) {
      expect(tableSql).toContain('"tenantId" uuid NOT NULL');
      expect(tableSql).toContain('"userId" character varying NOT NULL');
      expect(tableSql).toContain('"profileId" character varying NOT NULL');
      expect(tableSql).toContain(
        '"appScope" character varying NOT NULL DEFAULT \'finance\''
      );
      expect(tableSql).toContain('"workspace" character varying NOT NULL');
    }

    expect(tenantAccountFkSql).toBeDefined();
  });
});
