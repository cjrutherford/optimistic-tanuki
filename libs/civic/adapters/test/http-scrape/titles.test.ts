import { titleFromUrl } from '../../src/http-scrape/index.js';

describe('titleFromUrl', () => {
  const cases: [string, string | null][] = [
    [
      'https://www.nashvillega.com/AgendaCenter/ViewFile/Minutes/_07272026-35',
      'Minutes 07/27/2026',
    ],
    ['https://example.gov/docs/Agenda_08242026-39.pdf', 'Document 08/24/2026'],
    [
      'https://example.gov/packets/August-24-2026-packet.pdf',
      'Document August 24, 2026',
    ],
    [
      'https://example.gov/minutes/2026-07-13-minutes.pdf',
      'Document 07/13/2026',
    ],
    ['https://example.gov/about', null],
    // Opaque file ids are not dates: "109363" must not read as 10/93/2063.
    ['https://www.agendasuite.org/iip/groton/file/getfile/109363', null],
    ['https://example.gov/files/4013.pdf', null],
  ];
  for (const [url, expected] of cases) {
    it(`${url} → ${expected}`, () => {
      expect(titleFromUrl(url)).toBe(expected);
    });
  }
});

describe('titleFromUrl with encoded file names', () => {
  it('decodes the file name and ignores cache-busting query strings', () => {
    expect(
      titleFromUrl(
        'https://www.tiftcounty.org/Commission%20Agendas/Agenda%20-%20Regular%20Session%20-%2009.14.26.pdf?t=202609110946340'
      )
    ).toBe('Document 09/14/2026');
  });
});
