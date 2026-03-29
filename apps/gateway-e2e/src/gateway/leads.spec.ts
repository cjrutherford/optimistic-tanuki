import axios from 'axios';

describe('Leads API E2E Tests', () => {
  jest.setTimeout(10000);
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const api = axios.create({
    baseURL: `${baseURL}/api`,
    validateStatus: () => true,
  });

  let authToken: string;
  let userId: string;
  let testLeadId: string;

  const testUser = {
    email: `test-lead-${Date.now()}@example.com`,
    fn: 'Lead',
    ln: 'Test',
    password: 'Test@Password123',
    confirm: 'Test@Password123',
    bio: 'Lead test user',
  };

  const testLead = {
    name: 'Test Lead Company',
    company: 'Test Corp',
    email: 'lead@testcorp.com',
    phone: '555-9999',
    source: 'upwork',
    status: 'new',
    value: 10000,
    notes: 'E2E test lead',
  };

  beforeAll(async () => {
    const registerRes = await api.post('/authentication/register', testUser);
    if (registerRes.status === 201 && registerRes.data?.data?.user) {
      userId = registerRes.data.data.user.id;
    }

    const loginRes = await api.post('/authentication/login', {
      email: testUser.email,
      password: testUser.password,
    });
    if (loginRes.status === 201 && loginRes.data?.data?.newToken) {
      authToken = loginRes.data.data.newToken;
    }
  });

  describe('POST /api/leads', () => {
    it('should create a new lead', async () => {
      const res = await api.post('/leads', testLead, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();
      expect(res.data.name).toBe(testLead.name);
      expect(res.data.company).toBe(testLead.company);
      testLeadId = res.data.id;
    });

    it('should fail to create lead without auth', async () => {
      const res = await api.post('/leads', testLead);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/leads', () => {
    it('should get all leads', async () => {
      const res = await api.get('/leads', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should filter leads by status', async () => {
      const res = await api.get('/leads?status=new', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should filter leads by source', async () => {
      const res = await api.get('/leads?source=upwork', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('GET /api/leads/:id', () => {
    it('should get lead by id', async () => {
      const res = await api.get(`/leads/${testLeadId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.data.id).toBe(testLeadId);
    });

    it('should return 404 for non-existent lead', async () => {
      const res = await api.get('/leads/non-existent-id', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/leads/:id', () => {
    it('should update a lead', async () => {
      const res = await api.put(
        `/leads/${testLeadId}`,
        { status: 'contacted' },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(res.status).toBe(200);
      expect(res.data.status).toBe('contacted');
    });
  });

  describe('GET /api/leads/stats/overview', () => {
    it('should get lead statistics', async () => {
      const res = await api.get('/leads/stats/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.data.total).toBeDefined();
      expect(res.data.byStatus).toBeDefined();
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('should delete a lead', async () => {
      const res = await api.delete(`/leads/${testLeadId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(200);
    });

    it('should return 404 for deleted lead', async () => {
      const res = await api.get(`/leads/${testLeadId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.status).toBe(404);
    });
  });
});
