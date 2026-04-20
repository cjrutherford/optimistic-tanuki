import { Pool } from 'pg';

export interface DbConnectionOptions {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
}

export interface SeedEvidenceCounts {
  accounts?: number;
  transactions?: number;
  permissions?: number;
  appScopes?: number;
}

export function createDbPool(options: DbConnectionOptions): Pool {
  return new Pool({
    host: options.host ?? process.env['POSTGRES_HOST'] ?? 'localhost',
    port: options.port ?? Number(process.env['POSTGRES_PORT'] ?? '5432'),
    user: options.user ?? process.env['POSTGRES_USER'] ?? 'postgres',
    password:
      options.password ?? process.env['POSTGRES_PASSWORD'] ?? 'postgres',
    database: options.database,
  });
}

export async function queryCount(pool: Pool, sql: string): Promise<number> {
  const result = await pool.query<{ count: string }>(sql);
  return Number(result.rows[0]?.count ?? 0);
}

export async function getFinanceSeedEvidence(
  pool: Pool
): Promise<SeedEvidenceCounts> {
  const [accounts, transactions] = await Promise.all([
    queryCount(pool, 'SELECT COUNT(*)::text AS count FROM account'),
    queryCount(pool, 'SELECT COUNT(*)::text AS count FROM transaction'),
  ]);

  return { accounts, transactions };
}

export async function getPermissionsSeedEvidence(
  pool: Pool
): Promise<SeedEvidenceCounts> {
  const [permissions, appScopes] = await Promise.all([
    queryCount(pool, 'SELECT COUNT(*)::text AS count FROM permission'),
    queryCount(pool, 'SELECT COUNT(*)::text AS count FROM app_scope'),
  ]);

  return { permissions, appScopes };
}
