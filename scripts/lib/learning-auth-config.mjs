export function buildAuthenticationConfig(environment = process.env) {
  return {
    listenPort: Number(environment.AUTHENTICATION_PORT || 3101),
    database: {
      host: environment.POSTGRES_HOST || '127.0.0.1',
      port: Number(environment.POSTGRES_PORT || 5432),
      name: 'ot_authentication',
      username: environment.POSTGRES_USER || 'postgres',
      password: environment.POSTGRES_PASSWORD || 'postgres',
    },
    auth: {},
    oauth: {},
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.stdout.write(`${JSON.stringify(buildAuthenticationConfig())}\n`);
}
