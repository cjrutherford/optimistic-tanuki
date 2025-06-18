import { PostgreSqlContainer, GenericContainer, Wait } from 'testcontainers';
import { execSync } from 'child_process';
import * as path from 'path';
import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

// Ensure service names match exactly with ServiceName type in config.ts and YAML keys
const serviceDetails = [
  { name: 'authentication', port: 3001, envFile: 'authentication.env' },
  { name: 'profile', port: 3002, envFile: 'profile.env' },
  { name: 'social', port: 3003, envFile: 'social.env' },
  { name: 'tasks', port: 3004, envFile: 'tasks.env' },
  { name: 'asset', port: 3005, envFile: 'asset.env' }, // Corrected 'assets' to 'asset'
];
const dbPrefix = 'ot_test_';
const internalGatewayPort = 3000; // Default gateway port

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  console.log('Starting PostgreSQL container...');
  const pgContainer = await new PostgreSqlContainer().start();
  globalThis.postgresContainer = pgContainer; // Changed from pgContainer to postgresContainer for clarity
  console.log('PostgreSQL container started.');

  // Set PG vars for migration locally, not for inter-container communication yet
  process.env.POSTGRES_USER = pgContainer.getUsername();
  process.env.POSTGRES_PASSWORD = pgContainer.getPassword();
  process.env.POSTGRES_HOST = pgContainer.getHost(); // This is the host accessible from the setup script
  process.env.POSTGRES_PORT = String(pgContainer.getPort()); // This is the port accessible from the setup script

  for (const service of serviceDetails) {
    const dbName = `${dbPrefix}${service.name}`;
    process.env.POSTGRES_DB = dbName; // Set for current migration
    console.log(`Creating database ${dbName} for service ${service.name}...`);
    await pgContainer.exec([
      'psql',
      '-U',
      pgContainer.getUsername(),
      '-c',
      `CREATE DATABASE ${dbName}`,
    ]);
    console.log(`Database ${dbName} created.`);

    const servicePath = path.resolve(__dirname, `../../../../apps/${service.name}`);
    console.log(`Running migrations for service ${service.name} in ${servicePath}...`);
    try {
      execSync(
        `node -r ts-node/register -r tsconfig-paths/register ../../node_modules/typeorm/cli.js -d ./src/app/staticDatabase.ts migration:run`,
        { cwd: servicePath, stdio: 'inherit', env: { ...process.env } }
      );
      console.log(`Migrations for service ${service.name} completed.`);
    } catch (error) {
      console.error(`Error running migrations for service ${service.name}:`, error);
      throw error; // Fail setup if migrations fail
    }
  }

  console.log('\nStarting microservice containers...\n');
  const pgNetworkAlias = globalThis.postgresContainer.getNetworkAliases()[0]; // pg container is on the same network

  const microserviceEnvVars = {};

  for (const service of serviceDetails) {
    console.log(`Starting container for service ${service.name}...`);
    const contextPath = path.resolve(__dirname, `../../../../apps/${service.name}`);
    const dbName = `${dbPrefix}${service.name}`;
    const internalServicePort = service.port;

    try {
      const serviceContainerBuilder = await GenericContainer.fromDockerfile(contextPath, 'Dockerfile').build();

      const startedContainer = await serviceContainerBuilder
        .withExposedPorts(internalServicePort)
        .withEnvironment({
          POSTGRES_HOST: pgNetworkAlias,
          POSTGRES_PORT: '5432',
          POSTGRES_USER: globalThis.postgresContainer.getUsername(),
          POSTGRES_PASSWORD: globalThis.postgresContainer.getPassword(),
          POSTGRES_DB: dbName,
          LISTEN_PORT: String(internalServicePort),
          // Example JWT vars - these should ideally come from a secure config or be service-specific if they differ
          JWT_ACCESS_SECRET: 'test_access_secret_12345678901234567890123456789012',
          JWT_REFRESH_SECRET: 'test_refresh_secret_12345678901234567890123456789012',
          JWT_ACCESS_EXPIRATION: '15m',
          JWT_REFRESH_EXPIRATION: '7d',
        })
        .withWaitStrategy(Wait.forLogMessage(`Microservice ${service.name} is listening On Port: ${internalServicePort}`, 1))
        .start();

      globalThis[`${service.name}Container`] = startedContainer;
      const mappedTcpPort = startedContainer.getMappedPort(internalServicePort);
      globalThis[`mapped${service.name.charAt(0).toUpperCase() + service.name.slice(1)}TcpPort`] = mappedTcpPort;
      console.log(`Container for service ${service.name} started. Internal port: ${internalServicePort}, Mapped TCP port: ${mappedTcpPort}.`);

      // Prepare env vars for the gateway
      const serviceHostAlias = startedContainer.getNetworkAliases()[0] || startedContainer.getHost(); // Fallback to host IP if no alias
      microserviceEnvVars[`${service.name.toUpperCase()}_SERVICE_HOST`] = serviceHostAlias;
      microserviceEnvVars[`${service.name.toUpperCase()}_SERVICE_PORT`] = String(internalServicePort);

    } catch (error) {
      console.error(`Failed to start container for service ${service.name}:`, error);
      throw error;
    }
  }

  console.log('\nStarting gateway container...\n');
  const gatewayContextPath = path.resolve(__dirname, '../../../../apps/gateway');
  try {
    const gatewayContainerBuilder = await GenericContainer.fromDockerfile(gatewayContextPath, 'Dockerfile').build();
    const gatewayContainer = await gatewayContainerBuilder
      .withExposedPorts(internalGatewayPort)
      .withEnvironment({
        LISTEN_PORT: String(internalGatewayPort),
        ...microserviceEnvVars, // Spread the collected microservice host/port env vars
         // Add any other necessary gateway-specific env vars
        JWT_SECRET: 'test_jwt_secret_for_gateway_12345', // Example, ensure it's consistent if used by gateway for its own auth
      })
      // Use a log message that the gateway itself prints when ready
      // Example: "Nest application successfully started" or specific "Gateway is running on port XXXX"
      .withWaitStrategy(Wait.forLogMessage(`Application is running on: http://localhost:${internalGatewayPort}`, 1))
      .start();

    globalThis.gatewayContainer = gatewayContainer;
    globalThis.mappedGatewayPort = gatewayContainer.getMappedPort(internalGatewayPort);
    const gatewayHost = gatewayContainer.getHost();
    globalThis.gatewayBaseUrl = `http://${gatewayHost}:${globalThis.mappedGatewayPort}`;
    process.env.GATEWAY_E2E_BASE_URL = globalThis.gatewayBaseUrl;
    console.log(`Gateway container started on host ${gatewayHost} and mapped port ${globalThis.mappedGatewayPort}.`);
    console.log(`Gateway E2E Base URL set to: ${process.env.GATEWAY_E2E_BASE_URL}`);

  } catch (error) {
    console.error('Failed to start gateway container:', error);
    throw error;
  }

  // The waitForPortOpen might be redundant if the container's wait strategy is reliable.
  // If kept, it should point to the container's mapped port and host.
  // console.log(`Waiting for gateway to be ready on port ${globalThis.mappedGatewayPort}...`);
  // await waitForPortOpen(globalThis.mappedGatewayPort, { host: globalThis.gatewayContainer.getHost() });
  // console.log('Gateway is ready.');

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
