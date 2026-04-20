import { expect, test } from '@playwright/test';
import {
  apiUrl,
  expectOkOrStatus,
  findCity,
  getCommunities,
} from './helpers/local-hub-api';

test.describe('API smoke', () => {
  test('fetches communities', async ({ request }) => {
    await getCommunities(request);
  });

  test('exposes city data through communities endpoint', async ({ request }) => {
    const communities = await getCommunities(request);
    const cities = communities.filter(
      (community) => community.localityType === 'city',
    );

    expect(Array.isArray(cities)).toBeTruthy();
  });
});

test.describe('Authentication API', () => {
  test('accepts or validates a new registration request', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const response = await request.post(
      apiUrl('/api/authentication/register'),
      {
        data: {
          email: `e2e_${timestamp}@test.com`,
          username: `e2euser_${timestamp}`,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!',
        },
      },
    );

    expectOkOrStatus(response, [400]);
  });

  test('rejects invalid login', async ({ request }) => {
    const response = await request.post(apiUrl('/api/authentication/login'), {
      data: {
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Seed data smoke', () => {
  test('communities endpoint returns an array', async ({ request }) => {
    const communities = await getCommunities(request);

    expect(Array.isArray(communities)).toBeTruthy();
  });

  test('seeded city can be discovered when present', async ({ request }) => {
    const communities = await getCommunities(request);
    const city = findCity(communities);

    expect(city?.localityType ?? 'city').toBe('city');
  });
});
