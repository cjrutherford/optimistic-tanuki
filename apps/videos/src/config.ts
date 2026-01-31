export default () => ({
  port: parseInt(process.env['PORT'] || '3000', 10),
  database: {
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    username: process.env['POSTGRES_USER'] || 'postgres',
    password: process.env['POSTGRES_PASSWORD'] || 'postgres',
    database: process.env['POSTGRES_DB'] || 'videos',
  },
});
