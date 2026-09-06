import { parseCommunityLookupResponse } from './seed-classifieds.helpers';

describe('parseCommunityLookupResponse failure handling', () => {
  it.each([404, 500])(
    'returns null without reading the body for a %s response',
    async (status) => {
      const response = new Response(JSON.stringify({ id: 'community-1' }), {
        status,
      });

      await expect(parseCommunityLookupResponse(response)).resolves.toBeNull();
      // A non-ok response must short-circuit, leaving the body unconsumed.
      expect(response.bodyUsed).toBe(false);
    }
  );

  it('returns null when the body is not valid JSON', async () => {
    const response = new Response('<html>gateway error</html>', {
      status: 200,
    });

    await expect(parseCommunityLookupResponse(response)).resolves.toBeNull();
  });

  it('returns null when the JSON body carries no usable id', async () => {
    const response = new Response(JSON.stringify({ id: '' }), { status: 200 });

    await expect(parseCommunityLookupResponse(response)).resolves.toBeNull();
  });
});
