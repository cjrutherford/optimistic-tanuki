/** Bounds for parsing account-export HLS manifests before any bytes are emitted. */
export const ACCOUNT_EXPORT_HLS_LIMITS = Object.freeze({
  manifestBytes: 1024 * 1024,
  references: 8192,
  lines: 16_400,
  lineBytes: 1024,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_ASSET =
  /^\/api\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export class AccountExportHlsError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AccountExportHlsError';
  }
}

type ParsedLine = { kind: 'text'; value: string } | { kind: 'ref'; id: string };
type ParsedPlaylist = { lines: ParsedLine[]; referenceAssetIds: string[] };

/** Parses only the finite, local MPEG-TS media-playlist subset used by video processing. */
export function parseAccountExportHlsPlaylist(bytes: Buffer): {
  referenceAssetIds: readonly string[];
} {
  return { referenceAssetIds: parse(bytes).referenceAssetIds };
}

/** Rewrites API asset URI lines to already-verified, safe local leaf names. */
export function rewriteAccountExportHlsPlaylist(
  bytes: Buffer,
  resolver: (
    assetId: string
  ) => { fileName: string; mimeType: string } | undefined
): Buffer {
  if (typeof resolver !== 'function')
    throw new AccountExportHlsError('HLS_INVALID_RESOLVER');
  const parsed = parse(bytes);
  const rewritten = parsed.lines.map((line) => {
    if (line.kind === 'text') return line.value;
    const target = resolver(line.id);
    if (!target) throw new AccountExportHlsError('HLS_REFERENCE_UNRESOLVED');
    if (
      !UUID.test(line.id) ||
      !safeLeaf(target.fileName) ||
      target.mimeType !== 'video/mp2t' ||
      !target.fileName.toLowerCase().endsWith('.ts')
    )
      throw new AccountExportHlsError('HLS_REFERENCE_UNSAFE');
    return target.fileName;
  });
  return Buffer.from(`${rewritten.join('\n')}\n`, 'utf8');
}

function parse(bytes: Buffer): ParsedPlaylist {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length === 0 ||
    bytes.length > ACCOUNT_EXPORT_HLS_LIMITS.manifestBytes
  )
    throw new AccountExportHlsError('HLS_MANIFEST_SIZE_INVALID');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new AccountExportHlsError('HLS_UTF8_INVALID');
  }
  if (text.includes('\0') || /\r(?!\n)/.test(text))
    throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  if (raw.at(-1) === '') raw.pop();
  if (
    raw.length > ACCOUNT_EXPORT_HLS_LIMITS.lines ||
    raw.some(
      (line) =>
        Buffer.byteLength(line, 'utf8') > ACCOUNT_EXPORT_HLS_LIMITS.lineBytes
    )
  )
    throw new AccountExportHlsError('HLS_PLAYLIST_LIMIT_EXCEEDED');
  if (raw.length < 7 || raw[0] !== '#EXTM3U')
    throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
  const lines: ParsedLine[] = [{ kind: 'text', value: raw[0] }];
  const refs: string[] = [];
  const seen = new Set<string>();
  let version = false,
    target = false,
    sequence = false,
    ended = false;
  let pendingDuration = false,
    hasType = false,
    started = false,
    independent = false;
  let targetDuration = 0;
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i];
    if (ended || !line || line.trim() !== line || hasControlCharacters(line))
      throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
    if (line.startsWith('#')) {
      if (pendingDuration)
        throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
      if (
        !started &&
        /^#EXT-X-VERSION:(?:[1-9]|[1-9][0-9])$/.test(line) &&
        !version
      )
        version = true;
      else if (
        !started &&
        /^#EXT-X-TARGETDURATION:[1-9][0-9]{0,5}$/.test(line) &&
        !target
      ) {
        target = true;
        targetDuration = Number(line.slice('#EXT-X-TARGETDURATION:'.length));
      } else if (
        !started &&
        /^#EXT-X-MEDIA-SEQUENCE:(?:0|[1-9][0-9]{0,15})$/.test(line) &&
        !sequence
      )
        sequence = true;
      else if (!started && /^#EXT-X-PLAYLIST-TYPE:VOD$/.test(line) && !hasType)
        hasType = true;
      else if (
        line === '#EXT-X-INDEPENDENT-SEGMENTS' &&
        !started &&
        !independent
      ) {
        independent = true;
      } else if (line === '#EXT-X-DISCONTINUITY' && started) {
        /* accepted finite tags */
      } else if (line === '#EXT-X-ENDLIST') {
        if (i !== raw.length - 1 || !refs.length)
          throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
        ended = true;
      } else if (/^#EXTINF:(?:[0-9]+)(?:\.[0-9]{1,6})?,?$/.test(line)) {
        const duration = Number(line.slice(8).replace(/,$/, ''));
        if (
          !Number.isFinite(duration) ||
          duration <= 0 ||
          !target ||
          Math.round(duration) > targetDuration
        )
          throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
        pendingDuration = true;
      } else throw new AccountExportHlsError('HLS_PLAYLIST_UNSUPPORTED');
      lines.push({ kind: 'text', value: line });
      continue;
    }
    if (!pendingDuration || !version || !target || !sequence)
      throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
    const match = API_ASSET.exec(line);
    if (!match) throw new AccountExportHlsError('HLS_REFERENCE_INVALID');
    const id = match[1].toLowerCase();
    if (!UUID.test(id))
      throw new AccountExportHlsError('HLS_REFERENCE_INVALID');
    if (!seen.has(id)) {
      seen.add(id);
      refs.push(id);
      if (refs.length > ACCOUNT_EXPORT_HLS_LIMITS.references)
        throw new AccountExportHlsError('HLS_REFERENCE_LIMIT_EXCEEDED');
    }
    lines.push({ kind: 'ref', id });
    pendingDuration = false;
    started = true;
  }
  if (
    !ended ||
    pendingDuration ||
    !version ||
    !target ||
    !sequence ||
    !refs.length
  )
    throw new AccountExportHlsError('HLS_PLAYLIST_INVALID');
  return { lines, referenceAssetIds: refs };
}

function safeLeaf(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\/:?#%]/.test(value) &&
    !hasControlCharacters(value) &&
    !value.includes('..') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
