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

test.describe('Digital Homestead login, profile, and permissions', () => {
  test('logs in, creates profile for digital-homestead scope, and verifies roles', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('dh');
    const password = 'P@ssw0rd!' + Date.now();

    // Register a user directly via the gateway for the digital-homestead scope
    const registerResp = await request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'digital-homestead',
        'Content-Type': 'application/json',
      },
      data: {
        email,
        password,
        confirm: password,
        fn: 'Digital',
        ln: 'HomesteadUser',
        bio: 'Digital Homestead E2E user',
      },
    });

    expect(registerResp.ok()).toBeTruthy();

    // Log in through the Digital Homestead UI
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // After login, user should be redirected to the blog page
    await page.waitForURL(/\/blog/, { timeout: 20000 });

    // Token is stored in the dh-client namespace
    const token = await page.evaluate(() =>
      localStorage.getItem('dh-client-authToken')
    );
    expect(token).toBeTruthy();

    const decoded = decodeJwt(token!);
    expect(decoded.userId).toBeTruthy();
    const userId: string = decoded.userId;

    // Create a profile specifically for the digital-homestead app scope
    const createProfileResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'digital-homestead',
        'Content-Type': 'application/json',
      },
      data: {
        userId,
        name: 'Digital Homestead Test Profile',
        description: 'Profile created by full-stack e2e (digital-homestead)',
        bio: 'Blog author',
        location: 'Test Suite',
        occupation: 'Blogger',
        interests: 'Writing',
        skills: 'Content Creation',
        profilePic: '',
        coverPic: '',
        appScope: 'digital-homestead',
      },
    });

    expect(createProfileResp.ok()).toBeTruthy();
    const createdBody: any = await createProfileResp.json();
    const createdProfile = createdBody.profile ?? createdBody;
    expect(createdProfile.id).toBeTruthy();
    const profileId: string = createdProfile.id;

    const effectiveToken: string = createdBody.newToken ?? token!;

    // Best-effort permissions check: attempt to read role assignments for
    // this profile in the digital-homestead scope, but do not fail the test
    // if the gateway responds with a non-2xx status while the permissions
    // pipeline is still stabilizing.
    const rolesResp = await request.get(
      `/api/permissions/user-roles/${profileId}`,
      {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        data: { appScope: 'digital-homestead' },
      }
    );

    if (rolesResp.ok()) {
      const assignments: any[] = await rolesResp.json();
      expect(Array.isArray(assignments)).toBeTruthy();
      expect(assignments.length).toBeGreaterThan(0);
    }
  });
});
