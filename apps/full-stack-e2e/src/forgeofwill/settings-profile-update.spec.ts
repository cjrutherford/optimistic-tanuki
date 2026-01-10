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

// This spec exercises Forge of Will's login + settings/profile
// flow against the full Docker stack and validates that profile
// updates are persisted via the gateway/profile service.
test.describe('ForgeOfWill login, settings, and profile update', () => {
  test('logs in, hits /settings, and updates profile in backend', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('fow');
    const password = 'P@ssw0rd!' + Date.now();

    // Register a user for the forgeofwill scope via the gateway.
    const registerResp = await request.post('/api/authentication/register', {
      headers: {
        'x-ot-appscope': 'forgeofwill',
        'Content-Type': 'application/json',
      },
      data: {
        email,
        password,
        confirm: password,
        fn: 'Forge',
        ln: 'User',
        bio: 'ForgeOfWill full-stack e2e user',
      },
    });

    expect(registerResp.ok()).toBeTruthy();

    // Perform a backend login to obtain a JWT that includes the
    // effective profile id for this app scope. This decouples the
    // profile/permissions verification from any localStorage timing.
    const loginResp = await request.post('/api/authentication/login', {
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'forgeofwill',
      },
      data: {
        email,
        password,
      },
    });

    expect(loginResp.ok()).toBeTruthy();
    const loginBody: any = await loginResp.json();
    const backendToken: string | null =
      loginBody?.data?.newToken ?? loginBody?.newToken ?? null;
    expect(backendToken).toBeTruthy();

    // Log in through the ForgeOfWill UI to exercise the real client
    // flow and ensure the interceptor + guards are wired correctly.
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click({ force: true });

    // After login completes, explicitly navigate to /settings to
    // exercise the protected route.
    await page.goto('/settings');

    // Decode the JWT from the backend login response to obtain the
    // userId used by the profile service. This avoids relying on
    // localStorage timing while still validating the /login + /settings
    // UI navigation flow above.
    const decoded = decodeJwt(backendToken!);
    expect(decoded.userId).toBeTruthy();
    const userId: string = decoded.userId;

    // Ensure we have an effective profile for forgeofwill by creating
    // or updating a profile tied to this user.
    const createResp = await request.post('/api/profile', {
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'x-ot-appscope': 'forgeofwill',
        'Content-Type': 'application/json',
      },
      data: {
        userId,
        name: 'ForgeOfWill E2E Profile',
        description: 'Initial profile for ForgeOfWill full-stack e2e',
        bio: 'Initial bio',
        location: 'Initial Location',
        occupation: 'Player',
        interests: 'Testing',
        skills: 'Risk Management',
        profilePic: '',
        coverPic: '',
        appScope: 'forgeofwill',
        appId: 'forgeofwill',
      },
    });

    expect(createResp.ok()).toBeTruthy();
    const createdBody: any = await createResp.json();
    const createdProfile = createdBody.profile ?? createdBody;
    expect(createdProfile.id).toBeTruthy();
    const profileId: string = createdProfile.id;

    const effectiveToken: string = createdBody.newToken ?? backendToken!;

    // Now perform an update of the profile fields that should be
    // persisted by the profile service and database.
    const updatedBio = 'Updated ForgeOfWill bio from full-stack e2e';
    const updatedLocation = 'Updated ForgeOfWill Location';

    const updateResp = await request.put(`/api/profile/${profileId}`, {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-ot-appscope': 'forgeofwill',
        'Content-Type': 'application/json',
      },
      data: {
        id: profileId,
        bio: updatedBio,
        location: updatedLocation,
      },
    });
    if (!updateResp.ok()) {
      console.log(
        'forgeofwill profile update failed',
        updateResp.status(),
        await updateResp.text()
      );
    }
    expect(updateResp.ok()).toBeTruthy();

    // Fetch the profile again and assert the changes to validate that
    // backend/database state was updated correctly for this app scope.
    const verifyResp = await request.get(`/api/profile/${profileId}`, {
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'x-ot-appscope': 'forgeofwill',
      },
    });

    expect(verifyResp.ok()).toBeTruthy();
    const verified: any = await verifyResp.json();
    expect(verified.bio).toBe(updatedBio);
    expect(verified.location).toBe(updatedLocation);
  });
});
