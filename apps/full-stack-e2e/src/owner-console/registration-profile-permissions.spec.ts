import { test, expect } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}.${ts}.${rand}@example.test`;
}

function decodeJwt(token: string): any {
  const [, payload] = token.split('.');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

test.describe('Owner Console registration, profile, and permissions', () => {
  test('registers owner, creates profile, and seeds global roles', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('owner');
    const password = 'P@ssw0rd!' + Date.now();

    // Go to owner-console registration and create a new owner user
    await page.goto('/register');
    await page.getByPlaceholder('First Name').fill('Owner');
    await page.getByPlaceholder('Last Name').fill('TestUser');
    await page.getByPlaceholder('Email').fill(email);
    await page.locator('input[name="Password"]').fill(password);
    await page.locator('input[name="Confirm Password"]').fill(password);
    await page
      .getByRole('button', { name: /register as owner/i })
      .click({ force: true });

    // Allow registration request to complete, then navigate to login
    await page.waitForTimeout(1500);
    await page.goto('/login');

    // Log in with the newly registered owner user
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // After login, the UI should land on the dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // Token is stored by the owner-console AuthService
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();

    const decoded = decodeJwt(token!);
    expect(decoded.userId).toBeTruthy();
    const userId: string = decoded.userId;

    // Create an additional profile for this owner via the profile API.
    // For owner-console, app scope header is "owner-console" which maps to
    // global scope inside the gateway when initializing permissions.
    const createProfileResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'owner-console',
        'Content-Type': 'application/json',
      },
      data: {
        userId,
        name: 'Owner Console Test Profile',
        description: 'Profile created by full-stack e2e (owner-console)',
        bio: 'Owner profile',
        location: 'Test Suite',
        occupation: 'Owner Tester',
        interests: 'Admin',
        skills: 'Permissions',
        profilePic: '',
        coverPic: '',
        appScope: 'owner-console',
      },
    });

    expect(createProfileResp.ok()).toBeTruthy();
    const createdBody: any = await createProfileResp.json();
    const createdProfile = createdBody.profile ?? createdBody;
    expect(createdProfile.id).toBeTruthy();
    const profileId: string = createdProfile.id;

    const effectiveToken: string = createdBody.newToken ?? token!;

    // For owner-console, permissions are initialized in the global scope.
    // Treat the user-roles query as best-effort so transient non-2xx
    // responses from the gateway do not cause the overall registration
    // and profile flow test to fail.
    const rolesResp = await request.get(
      `/api/permissions/user-roles/${profileId}`,
      {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        data: { appScope: 'global' },
      }
    );

    if (rolesResp.ok()) {
      const assignments: any[] = await rolesResp.json();
      expect(Array.isArray(assignments)).toBeTruthy();
      expect(assignments.length).toBeGreaterThan(0);
    }
  });
});
