import { parseCommunityLookupResponse } from './seed-classifieds.helpers';

describe('classifieds seed community lookup', () => {
  it('returns null for successful responses with an empty body', async () => {
    const response = new Response('', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseCommunityLookupResponse(response)).resolves.toBeNull();
  });

  it('returns the community id for valid JSON responses', async () => {
    const response = new Response(
      JSON.stringify({ id: 'f2f40d77-a388-43a8-ab07-7c45b97e3147' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    await expect(parseCommunityLookupResponse(response)).resolves.toBe(
      'f2f40d77-a388-43a8-ab07-7c45b97e3147'
    );
  });
});
