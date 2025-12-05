import axios from 'axios';

describe('Gateway E2E Tests', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const api = axios.create({
    baseURL: `${baseURL}/api`,
    validateStatus: () => true, // Don't throw on any status code
  });

  let authToken: string;
  let userId: string;
  const testUser = {
    email: `test-gateway-${Date.now()}@example.com`,
    fn: 'Gateway',
    ln: 'Test',
    password: 'Test@Password123',
    confirm: 'Test@Password123',
    bio: 'Gateway test user',
  };

  describe('Authentication Endpoints', () => {
    describe('POST /api/authentication/register', () => {
      it('should register a new user', async () => {
        const res = await api.post('/authentication/register', testUser);

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        expect(res.data.data).toBeDefined();
        expect(res.data.data.user).toBeDefined();
        expect(res.data.data.user.email).toBe(testUser.email);

        userId = res.data.data.user.id;
      });

      it('should fail to register with duplicate email', async () => {
        const res = await api.post('/authentication/register', testUser);

        expect(res.status).toBe(500);
      });

      it('should fail to register with missing fields', async () => {
        const res = await api.post('/authentication/register', {
          email: 'incomplete@example.com',
        });

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/authentication/login', () => {
      it('should login with valid credentials', async () => {
        const res = await api.post('/authentication/login', {
          email: testUser.email,
          password: testUser.password,
        });

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        expect(res.data.data).toBeDefined();
        expect(res.data.data.newToken).toBeDefined();

        authToken = res.data.data.newToken;
      });

      it('should fail to login with invalid credentials', async () => {
        const res = await api.post('/authentication/login', {
          email: testUser.email,
          password: 'WrongPassword123!',
        });

        expect(res.status).toBe(500);
      });

      it('should fail to login with missing fields', async () => {
        const res = await api.post('/authentication/login', {
          email: testUser.email,
        });

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/authentication/validate', () => {
      it('should validate a valid token', async () => {
        const res = await api.post('/authentication/validate', {
          token: authToken,
          userId: userId,
        });

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        expect(res.data.code).toBe(0);
        expect(res.data.data).toBeDefined();
      });

      it('should fail to validate an invalid token', async () => {
        const res = await api.post('/authentication/validate', {
          token: 'invalid-token-12345',
          userId: userId,
        });

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/authentication/reset', () => {
      it('should reset password with valid credentials', async () => {
        const res = await api.post('/authentication/reset', {
          email: testUser.email,
          oldPass: testUser.password,
          newPass: 'NewPassword123!',
          newConf: 'NewPassword123!',
        });

        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        expect(res.data.code).toBe(0);
      });

      it('should fail to reset with wrong old password', async () => {
        const res = await api.post('/authentication/reset', {
          email: testUser.email,
          oldPass: 'WrongPassword123!',
          newPass: 'NewPassword456!',
          newConf: 'NewPassword456!',
        });

        expect(res.status).toBe(500);
      });
    });
  });

  describe('Swagger Documentation', () => {
    it('should serve Swagger UI', async () => {
      const res = await axios.get(`${baseURL}/api-docs`, {
        validateStatus: () => true,
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });
});
