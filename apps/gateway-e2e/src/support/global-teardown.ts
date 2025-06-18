import { killPort } from '@nx/node/utils';
/* eslint-disable */

// Ensure service names match exactly with ServiceName type in config.ts and serviceDetails in setup
const serviceNames = ['authentication', 'profile', 'social', 'tasks', 'asset'];

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.

  // Stop Gateway container first (or concurrently with microservices)
  if (globalThis.gatewayContainer) {
    try {
      console.log('Stopping gateway container...');
      await globalThis.gatewayContainer.stop();
      console.log('Gateway container stopped.');
    } catch (error) {
      console.error('Error stopping gateway container:', error);
    }
  } else {
    // If gateway wasn't containerized (e.g. local dev), kill its port if was started by previous logic
     const port = process.env.PORT ? Number(process.env.PORT) : 3000;
     await killPort(port);
  }


  // Stop microservice containers
  for (const serviceName of serviceNames.reverse()) {
    const container = globalThis[`${serviceName}Container`];
    if (container) {
      try {
        console.log(`Stopping container for service ${serviceName}...`);
        await container.stop();
        console.log(`Container for service ${serviceName} stopped.`);
      } catch (error) {
        console.error(`Error stopping container for service ${serviceName}:`, error);
      }
    }
  }

  // Stop PostgreSQL container
  if (globalThis.postgresContainer) {
    try {
      console.log('Stopping PostgreSQL container...');
      await globalThis.postgresContainer.stop();
      console.log('PostgreSQL container stopped.');
    } catch (error) {
      console.error('Error stopping PostgreSQL container:', error);
    }
  }

  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
