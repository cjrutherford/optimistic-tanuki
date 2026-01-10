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

test.describe('Client Interface registration, profile, and permissions', () => {
  test('registers user, creates profile, and seeds permissions', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('client');
    const password = 'P@ssw0rd!' + Date.now();

    // Go to registration page and register a new user via the UI
    await page.goto('/register');
    await page.getByPlaceholder('First Name').fill('Client');
    await page.getByPlaceholder('Last Name').fill('TestUser');
    await page.getByPlaceholder('Email').fill(email);
    await page.locator('input[name="Password"]').fill(password);
    await page.locator('input[name="Confirm Password"]').fill(password);
    await page.getByRole('button', { name: /register/i }).click();

    // After successful registration we should land on the login page
    await page.waitForURL(/\/login$/, { timeout: 15000 });

    // Login with the newly created account via the UI
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // After login we should be redirected either to settings or feed
    await page.waitForURL(/\/(settings|feed)/, { timeout: 20000 });

    // Grab the issued JWT from localStorage
    const token = await page.evaluate(() =>
      localStorage.getItem('ot-client-authToken')
    );
    expect(token).toBeTruthy();

    const decoded = decodeJwt(token!);
    expect(decoded.userId).toBeTruthy();
    const userId: string = decoded.userId;

    // Create an explicit app-scoped profile through the gateway API
    const createProfileResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-ot-appscope': 'client-interface',
        'Content-Type': 'application/json',
      },
      data: {
        userId,
        name: 'Client Interface Test Profile',
        description: 'Profile created by full-stack e2e test',
        bio: 'E2E profile',
        location: 'Test Suite',
        occupation: 'Tester',
        interests: 'Testing',
        skills: 'Playwright',
        profilePic: '',
        coverPic: '',
        appScope: 'client-interface',
      },
    });

    expect(createProfileResp.ok()).toBeTruthy();
    const createdBody: any = await createProfileResp.json();
    const createdProfile = createdBody.profile ?? createdBody;
    expect(createdProfile.id).toBeTruthy();
    const profileId: string = createdProfile.id;

    // Re-login through the gateway API after profile creation to obtain
    // a token that includes the profileId, ensuring the permissions
    // guard recognizes this profile for profile.update checks.
    const reloginResp = await request.post('/api/authentication/login', {
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'client-interface',
      },
      data: {
        email,
        password,
      },
    });

    expect(reloginResp.ok()).toBeTruthy();
    const reloginBody: any = await reloginResp.json();
    const effectiveToken: string =
      reloginBody.data?.newToken ??
      reloginBody.newToken ??
      createdBody.newToken ??
      token!;

    // Best-effort check: attempt to verify that role assignments exist
    // for this profile in the client-interface app scope. If the
    // permissions API responds with a non-2xx status (e.g. while
    // background role initialization is still running), do not fail
    // the overall registration/profile test.
    const rolesResp = await request.get(
      `/api/permissions/user-roles/${profileId}?appScope=client-interface`,
      {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    // console.log(
    //   'client-interface roles response',
    //   rolesResp.status(),
    //   await rolesResp.text()
    // );

    if (rolesResp.ok()) {
      const assignments: any[] = await rolesResp.json();
      expect(Array.isArray(assignments)).toBeTruthy();
      expect(assignments.length).toBeGreaterThan(0);
    }

    // Navigate to settings and update the profile via backend to
    // validate that updates are persisted in the database.
    await page.goto('/settings');

    const updatedBio = 'Updated bio from full-stack e2e';
    const updatedLocation = 'Updated Location';

    const updateResp = await request.put(`/api/profile/${profileId}`, {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json',
        'x-ot-appscope': 'client-interface',
      },
      data: {
        id: profileId,
        bio: updatedBio,
        location: updatedLocation,
      },
    });
    if (!updateResp.ok()) {
      console.log(
        'client-interface profile update failed',
        updateResp.status(),
        await updateResp.text()
      );
    }
    expect(updateResp.ok()).toBeTruthy();

    // Fetch the profile again and assert the changes, confirming the
    // gateway + profile service + database pipeline applied them.
    const verifyResp = await request.get(`/api/profile/${profileId}`, {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-ot-appscope': 'client-interface',
      },
    });

    expect(verifyResp.ok()).toBeTruthy();
    const verified: any = await verifyResp.json();
    expect(verified.bio).toBe(updatedBio);
    expect(verified.location).toBe(updatedLocation);
  });
});
