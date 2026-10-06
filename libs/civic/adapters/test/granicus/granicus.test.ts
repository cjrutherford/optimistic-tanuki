import { granicusAdapter, parseMeetingList } from '../../src/granicus/index.js';

const PAGE = `<html><body><table>
<tr><td>City Council — Sep 2, 2026</td><td><a href="/AgendaViewer/ViewAgenda.php?id=1">Agenda</a></td><td><a href="/VideoViewer?id=9">Video</a></td></tr>
<tr><td>Planning Commission — Aug 20, 2026</td><td><a href="/docs/packet.pdf">Agenda Packet</a></td><td><a href="/docs/min.pdf">Minutes</a></td></tr>
<tr><td>Site footer</td><td><a href="/contact">Contact</a></td></tr>
</table></body></html>`;

describe('parseMeetingList', () => {
  it('extracts dated doc links, skips video and nav', () => {
    const links = parseMeetingList(
      PAGE,
      'https://demo.granicus.com/ViewPublisher.php?view_id=1'
    );
    const docs = links.filter((l) => l.docType !== 'Video');
    expect(docs.length).toBe(3);
    expect(
      docs.some((l) => l.docType === 'Agenda' && l.url.includes('id=1'))
    ).toBeTruthy();
    expect(docs.some((l) => l.docType === 'Packet')).toBeTruthy();
    expect(docs.some((l) => l.docType === 'Minutes')).toBeTruthy();
    expect(!links.some((l) => l.url.includes('/contact'))).toBeTruthy();
  });

  it('parses the emitted text payload contract', async () => {
    const source = {
      sourceKey: 'x',
      ownerSlug: 'town-a',
      coverage: 'mentions' as const,
      adapter: 'granicus',
      name: 'Granicus',
      url: 'https://demo.granicus.com',
      kind: 'meeting' as const,
    };
    const [item] = await granicusAdapter.parse(
      {
        url: 'https://demo.granicus.com/docs/packet.pdf',
        contentType: 'application/granicus-link+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            dateText: 'Sep 2, 2026',
            rowTitle: 'City Council',
            docType: 'Packet',
            url: 'https://demo.granicus.com/docs/packet.pdf',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toMatch(/City Council/);
  });
});
