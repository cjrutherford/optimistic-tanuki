import {
  AccountExportHlsError,
  parseAccountExportHlsPlaylist,
  rewriteAccountExportHlsPlaylist,
} from './account-export-hls';

const a = '01234567-89ab-4cde-8fab-0123456789ab';
const b = '11234567-89ab-4cde-8fab-0123456789ab';
const playlist = (
  entries = [`#EXTINF:6.000,\n/api/asset/${a}`, `#EXTINF:4,\n/api/asset/${b}`]
) =>
  Buffer.from(
    [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:0',
      ...entries,
      '#EXT-X-ENDLIST',
      '',
    ].join('\n')
  );

describe('account export HLS helper', () => {
  it('parses supported media playlist references and rewrites only URI lines', () => {
    expect(parseAccountExportHlsPlaylist(playlist()).referenceAssetIds).toEqual(
      [a, b]
    );
    expect(
      rewriteAccountExportHlsPlaylist(playlist(), (id) => ({
        fileName: id === a ? 'segment-000.ts' : 'segment-001.ts',
        mimeType: 'video/mp2t',
      })).toString()
    ).toContain('#EXTINF:6.000,\nsegment-000.ts');
  });

  it.each([
    ['bad UTF-8', Buffer.from([0xff, 0xfe])],
    ['external URI', playlist([`#EXTINF:1,\nhttps://example.test/${a}.ts`])],
    [
      'key directive',
      playlist([
        `#EXT-X-KEY:METHOD=AES-128,URI="key"`,
        `#EXTINF:1,\n/api/asset/${a}`,
      ]),
    ],
    [
      'master playlist',
      playlist([
        `#EXT-X-STREAM-INF:BANDWIDTH=1000`,
        `#EXTINF:1,\n/api/asset/${a}`,
      ]),
    ],
    ['unfinished duration', playlist([`#EXTINF:1,`])],
    ['zero duration', playlist([`#EXTINF:0,\n/api/asset/${a}`])],
    ['URI without duration', playlist([`/api/asset/${a}`])],
    [
      'repeated URI without duration',
      playlist([`#EXTINF:1,\n/api/asset/${a}`, `/api/asset/${b}`]),
    ],
    [
      'no ENDLIST',
      Buffer.from(playlist().toString().replace('#EXT-X-ENDLIST\n', '')),
    ],
  ])('rejects %s', (_label, bytes) => {
    expect(() => parseAccountExportHlsPlaylist(bytes)).toThrow(
      AccountExportHlsError
    );
  });

  it('rejects unresolved references, unsafe leaves, and non-TS mappings', () => {
    expect(() =>
      rewriteAccountExportHlsPlaylist(
        playlist([`#EXTINF:1,\n/api/asset/${a}`]),
        () => undefined
      )
    ).toThrow('HLS_REFERENCE_UNRESOLVED');
    expect(() =>
      rewriteAccountExportHlsPlaylist(
        playlist([`#EXTINF:1,\n/api/asset/${a}`]),
        () => ({ fileName: '../x.ts', mimeType: 'video/mp2t' })
      )
    ).toThrow('HLS_REFERENCE_UNSAFE');
    expect(() =>
      rewriteAccountExportHlsPlaylist(
        playlist([`#EXTINF:1,\n/api/asset/${a}`]),
        () => ({ fileName: 'x.mp4', mimeType: 'video/mp4' })
      )
    ).toThrow('HLS_REFERENCE_UNSAFE');
  });

  it('enforces manifest and unique-reference budgets', () => {
    expect(() =>
      parseAccountExportHlsPlaylist(Buffer.alloc(1_048_577))
    ).toThrow('HLS_MANIFEST_SIZE_INVALID');
    const entries = Array.from({ length: 8193 }, (_, index) => {
      const id = `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
      return `#EXTINF:1,\n/api/asset/${id}`;
    });
    expect(() => parseAccountExportHlsPlaylist(playlist(entries))).toThrow(
      'HLS_REFERENCE_LIMIT_EXCEEDED'
    );
  });

  it('compares segment duration to target duration using nearest-integer rounding', () => {
    expect(() =>
      parseAccountExportHlsPlaylist(playlist([`#EXTINF:6.1,\n/api/asset/${a}`]))
    ).not.toThrow();
    expect(() =>
      parseAccountExportHlsPlaylist(playlist([`#EXTINF:6.6,\n/api/asset/${a}`]))
    ).toThrow('HLS_PLAYLIST_INVALID');
  });
});
