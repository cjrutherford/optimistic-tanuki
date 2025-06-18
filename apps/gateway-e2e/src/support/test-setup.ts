import supertest from 'supertest';

const GATEWAY_E2E_BASE_URL = process.env.GATEWAY_E2E_BASE_URL;

if (!GATEWAY_E2E_BASE_URL) {
  throw new Error(
    'GATEWAY_E2E_BASE_URL environment variable is not set. ' +
    'Ensure it is set in global-setup.ts (e.g., process.env.GATEWAY_E2E_BASE_URL = `http://${host}:${port}`)'
  );
}

export const api = supertest(GATEWAY_E2E_BASE_URL);

// If you were using axios elsewhere for e2e tests and wanted to set its defaults:
// import axios from 'axios';
// axios.defaults.baseURL = GATEWAY_E2E_BASE_URL;

console.log(`Supertest configured with base URL: ${GATEWAY_E2E_BASE_URL}`);
