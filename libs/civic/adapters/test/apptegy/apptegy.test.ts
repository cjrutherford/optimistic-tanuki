import { apptegyAdapter } from '../../src/apptegy/index.js';

const source = {
  sourceKey: 'apptegy-test',
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter: 'apptegy',
  name: 'School news',
  url: 'https://example.test',
  kind: 'news' as const,
};

describe('apptegy payload contract', () => {
  it('extracts article blocks from the text payload', async () => {
    const [item] = await apptegyAdapter.parse(
      {
        url: source.url,
        contentType: 'text/apptegy-page',
        payload: {
          kind: 'text',
          body: '<p>The town school board approved a new calendar for students.</p>',
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toMatch(/town school board/i);
  });
});
