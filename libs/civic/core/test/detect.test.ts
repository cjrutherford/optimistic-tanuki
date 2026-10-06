import { detectFromHtml } from '../src/detect.js';

describe('detectFromHtml', () => {
  it('fingerprints known platforms', () => {
    expect(
      detectFromHtml(
        '<a href="InSite.aspx">x</a>',
        'https://demo.legistar.com/Calendar.aspx'
      ).platform
    ).toBe('legistar');
    expect(
      detectFromHtml('ViewPublisher MetaViewer', 'https://demo.granicus.com/x')
        .platform
    ).toBe('granicus');
    expect(
      detectFromHtml(
        'civicclerk.com portal',
        'https://demo.civicclerk.com/web/x'
      ).platform
    ).toBe('civicclerk');
    expect(
      detectFromHtml(
        'AgendaCenter CivicPlus',
        'https://www.nashvillega.com/agendacenter'
      ).platform
    ).toBe('civicplus');
    expect(
      detectFromHtml(
        'thrillshare apptegy payload',
        'https://www.berrienschools.org/'
      ).platform
    ).toBe('apptegy');
    expect(
      detectFromHtml('<html><body>hello</body></html>', 'https://example.org/')
        .platform
    ).toBe('generic');
  });
  it('suggests client config for legistar', () => {
    const d = detectFromHtml(
      'legistar.com',
      'https://chicago.legistar.com/Calendar.aspx'
    );
    expect(d.adapter).toBe('legistar');
    expect(d.suggestedConfig['client']).toBe('chicago');
  });
});
