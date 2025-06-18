import { api } from '../support/test-setup'; // api is our pre-configured supertest instance
import { Pool } from 'pg';
import { RegisterRequest } from '@optimistic-tanuki/models'; // Assuming this is the correct model

// Helper to generate unique email for testing
const generateUniqueEmail = () => `testuser_${Date.now()}@example.com`;

describe('Gateway Integration Tests', () => {
  let pool: Pool;
  let authToken: string | null = null;
  const testUserEmail = generateUniqueEmail();
  const testUserPassword = 'password123';
  const testUsername = `testuser_${Date.now()}`;

  beforeAll(async () => {
    if (!globalThis.postgresContainer) {
      throw new Error('PostgreSQL container is not available on globalThis.postgresContainer');
    }
    // Connection details for pg.Pool from the PostgreSQL test container
    // The test code (Jest/Playwright worker) connects to the mapped port on the host.
    pool = new Pool({
      host: globalThis.postgresContainer.getHost(),
      port: globalThis.postgresContainer.getMappedPort(5432),
      user: globalThis.postgresContainer.getUsername(),
      password: globalThis.postgresContainer.getPassword(),
      // Database name will be set per query or we can connect to a default one like 'postgres'
      // and then query specific test databases if needed, but for simplicity,
      // we'll target the specific DB in queries.
    });
    await pool.connect(); // Test connection
    console.log('pg.Pool connected to PostgreSQL container for tests.');
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
      console.log('pg.Pool connection closed.');
    }
  });

  describe('User Registration (/authentication/register)', () => {
    it('should reject registration with an empty payload with 400', async () => {
      const response = await api.post('/authentication/register').send({});
      // HTTP status for validation errors can be 400 or 422.
      // The gateway controller currently throws HttpException with INTERNAL_SERVER_ERROR (500)
      // if the microservice call fails or returns an error that isn't handled well.
      // This should ideally be a 400 or 422 if validation is done at gateway/microservice level.
      // For now, let's check what the actual behavior is.
      // The DTOs in @optimistic-tanuki/models should have class-validator decorators.
      // If they are properly used with ValidationPipe in NestJS, it would be 400.
      expect(response.status).toBe(400); // Or 500 if error handling is not specific
    });

    it('should reject registration with missing email with 400', async () => {
      const response = await api.post('/authentication/register').send({ password: testUserPassword, username: testUsername });
      expect(response.status).toBe(400); // Assuming ValidationPipe is used
    });

    it('should reject registration with missing password with 400', async () => {
        const response = await api.post('/authentication/register').send({ email: testUserEmail, username: testUsername });
        expect(response.status).toBe(400); // Assuming ValidationPipe is used
    });

    it('should reject registration with invalid email format with 400', async () => {
      const response = await api.post('/authentication/register').send({ email: 'invalid-email', password: testUserPassword, username: testUsername });
      expect(response.status).toBe(400); // Assuming ValidationPipe is used
    });

    it('should successfully register a new user with 201', async () => {
      const payload: RegisterRequest = {
        email: testUserEmail,
        password: testUserPassword,
        username: testUsername, // Assuming RegisterRequest includes username
        firstName: 'Test', // Optional, depends on RegisterRequest model
        lastName: 'User',  // Optional
      };
      const response = await api.post('/authentication/register').send(payload);
      expect(response.status).toBe(201);
      expect(response.body).toBeDefined(); // Or more specific checks on response body

      // Database Verification
      const dbName = `ot_test_authentication`; // As per global-setup.ts
      const result = await pool.query(
        `SELECT * FROM "user_entity" WHERE "email" = $1 AND "database_name" = $2`, // Assuming a common user table schema for multitenancy
        [testUserEmail, dbName]
      );

      // If not multitenant per table, but per DB:
      // Need to switch connection or ensure pool is connected to 'ot_test_authentication'
      // For simplicity, let's assume the pool can query across DBs or is connected to the right one.
      // A more robust way is to create a client per test DB if necessary.
      // For now, assuming 'ot_test_authentication' is the target for the pool or query.
      // The current pool connects to the default DB. To query a specific DB, one might need
      // to connect the pool to `globalThis.postgresContainer.getDatabase() + '_authentication'` if that's how it was made,
      // or simply use `SELECT * FROM ot_test_authentication.user_entity...` if permissions allow.
      // Given current setup, migrations run per-service with POSTGRES_DB set.
      // So, the table `user_entity` exists within the `ot_test_authentication` database.
      // We need a pool connected to this specific database.

      // Re-configure pool for specific DB for this query, or ensure this is handled if pool is to default db
      const authDbPool = new Pool({
        host: globalThis.postgresContainer.getHost(),
        port: globalThis.postgresContainer.getMappedPort(5432),
        user: globalThis.postgresContainer.getUsername(),
        password: globalThis.postgresContainer.getPassword(),
        database: 'ot_test_authentication',
      });
      try {
        const userInDb = await authDbPool.query('SELECT * FROM "user_entity" WHERE "email" = $1', [testUserEmail]);
        expect(userInDb.rows.length).toBe(1);
        expect(userInDb.rows[0].email).toBe(testUserEmail);
        // Password should be hashed, so don't check plain password
      } finally {
        await authDbPool.end();
      }
    });
  });

  describe('User Login (/authentication/login)', () => {
    it('should reject login with invalid credentials with 401/400', async () => {
      const response = await api.post('/authentication/login').send({ email: testUserEmail, password: 'wrongpassword' });
      // Unauthorized or Bad Request depending on how the auth service handles it
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it('should successfully log in the registered user with 201', async () => {
      const response = await api.post('/authentication/login').send({ email: testUserEmail, password: testUserPassword });
      expect(response.status).toBe(201); // As per controller's ApiResponse
      expect(response.body).toHaveProperty('access_token');
      expect(response.body.access_token).toBeTruthy();
      authToken = response.body.access_token; // Save for subsequent tests
    });
  });

  describe('Protected Profile Endpoint (/profile)', () => {
    it('should reject access without token with 401', async () => {
      const response = await api.get('/profile'); // Path from ProfileController @Get()
      expect(response.status).toBe(401);
    });

    it('should reject access with an invalid token with 401', async () => {
      const response = await api.get('/profile').set('Authorization', 'Bearer invalidtoken123');
      expect(response.status).toBe(401);
    });

    it('should allow access with a valid token with 200', async () => {
      if (!authToken) {
        throw new Error('Auth token not available. Ensure login test runs and succeeds before this test.');
      }
      const response = await api.get('/profile').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      // The response body here would depend on whether a profile was auto-created for the user
      // or if it's an empty array/object. The main thing is the 200 OK.
      // For a new user, this might return an empty array or a default profile structure.
      // Example: expect(response.body).toBeInstanceOf(Array);
    });
  });
});
