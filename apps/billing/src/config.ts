export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export default () => ({
  database: {
    host: process.env['BILLING_DB_HOST'] || process.env['DB_HOST'] || 'localhost',
    port: Number(process.env['BILLING_DB_PORT'] || process.env['DB_PORT'] || 5432),
    username:
      process.env['BILLING_DB_USERNAME'] ||
      process.env['DB_USERNAME'] ||
      'postgres',
    password:
      process.env['BILLING_DB_PASSWORD'] ||
      process.env['DB_PASSWORD'] ||
      'postgres',
    database:
      process.env['BILLING_DB_NAME'] ||
      process.env['DB_NAME'] ||
      'ot_billing',
    synchronize: process.env['DB_SYNCHRONIZE'] === 'true',
    logging: process.env['DB_LOGGING'] === 'true',
  } as DatabaseConfig,
});
