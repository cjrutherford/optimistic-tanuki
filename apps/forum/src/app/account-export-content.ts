/** Safe projection data; consumers must render `text`, never inject markup as HTML. */
export type ForumContentProjection = {
  text: string;
  markup: Array<{
    kind: 'p' | 'strong' | 'em' | 'code' | 'br' | 'link' | 'image';
    text?: string;
    url?: string;
    alt?: string;
  }>;
  resources: Array<
    | { kind: 'asset'; assetId: string; status: 'referenceOnly-unverified' }
    | { kind: 'external'; url: string; status: 'referenceOnly-unverified' }
  >;
};
export const FORUM_CONTENT_MAX_LENGTH = 100_000;
const ATTR_MAX = 2048;

function entities(value: string): string {
  const tokens = value.match(/&(?:[a-z][a-z0-9]*|#[^;\s]*);/gi) ?? [];
  for (const token of tokens)
    if (!/^&(?:amp|lt|gt|quot|apos|#39|#x[\da-f]{1,6}|#\d{1,7});$/i.test(token))
      throw new Error('FORUM_EXPORT_INVALID_ENTITY');
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#39|#x[\da-f]{1,6}|#\d{1,7});/gi,
    (entity) => {
      const named: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
      };
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const lower = entity.toLowerCase();
      const n = lower.startsWith('&#x')
        ? parseInt(lower.slice(3, -1), 16)
        : parseInt(lower.slice(2, -1), 10);
      if (!n || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff))
        throw new Error('FORUM_EXPORT_INVALID_ENTITY');
      return String.fromCodePoint(n);
    }
  );
}
export function projectForumReference(
  raw: string
): ForumContentProjection['resources'][number] {
  if (typeof raw !== 'string' || !raw || raw.length > ATTR_MAX)
    throw new Error('FORUM_EXPORT_UNSUPPORTED_RESOURCE');
  const value = entities(raw);
  if (
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        character === '\\' ||
        character === '&'
    )
  )
    throw new Error('FORUM_EXPORT_UNSUPPORTED_RESOURCE');
  const asset =
    /^\/(?:api\/)?asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      value
    );
  if (asset)
    return {
      kind: 'asset',
      assetId: asset[1].toLowerCase(),
      status: 'referenceOnly-unverified',
    };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('FORUM_EXPORT_UNSUPPORTED_RESOURCE');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('FORUM_EXPORT_UNSUPPORTED_RESOURCE');
  return {
    kind: 'external',
    url: url.toString(),
    status: 'referenceOnly-unverified',
  };
}

/** Fully consumes plain text or a strict subset of common Forum HTML; no browser or sanitizer involved. */
export function projectForumContent(input: unknown): ForumContentProjection {
  if (typeof input !== 'string' || input.length > FORUM_CONTENT_MAX_LENGTH)
    throw new Error('FORUM_EXPORT_CONTENT_LIMIT');
  const result: ForumContentProjection = {
    text: '',
    markup: [],
    resources: [],
  };
  const stack: string[] = [];
  let i = 0;
  const append = (s: string) => {
    result.text += entities(s);
  };
  const parseAttrs = (raw: string): Record<string, string> => {
    const attrs: Record<string, string> = {};
    let rest = raw;
    while (rest.length) {
      const ws = /^\s+/.exec(rest);
      if (ws) {
        rest = rest.slice(ws[0].length);
        continue;
      }
      if (!rest) break;
      const m = /^([a-zA-Z][\w-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/.exec(
        rest
      );
      if (!m) throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE_SYNTAX');
      const name = m[1].toLowerCase();
      if (attrs[name] !== undefined)
        throw new Error('FORUM_EXPORT_DUPLICATE_ATTRIBUTE');
      attrs[name] = m[2] ?? m[3];
      rest = rest.slice(m[0].length);
      if (rest.length && !/^\s/.test(rest))
        throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE_SYNTAX');
    }
    return attrs;
  };
  while (i < input.length) {
    if (input[i] !== '<') {
      const next = input.indexOf('<', i);
      const end = next < 0 ? input.length : next;
      append(input.slice(i, end));
      i = end;
      continue;
    }
    const end = input.indexOf('>', i + 1);
    if (end < 0) throw new Error('FORUM_EXPORT_UNSUPPORTED_MARKUP');
    const token = input.slice(i + 1, end).trim();
    const close = /^\/([a-z][a-z0-9]*)$/i.exec(token);
    if (close) {
      const tag = close[1].toLowerCase();
      if (
        !['p', 'strong', 'em', 'code', 'a'].includes(tag) ||
        stack.pop() !== tag
      )
        throw new Error('FORUM_EXPORT_UNSUPPORTED_MARKUP');
      result.markup.push({
        kind: tag === 'a' ? 'link' : (tag as 'p' | 'strong' | 'em' | 'code'),
      });
    } else {
      const selfClosing = token.endsWith('/');
      const opening = selfClosing ? token.slice(0, -1).trimEnd() : token;
      const open = /^([a-z][a-z0-9]*)([\s\S]*)$/i.exec(opening);
      if (!open) throw new Error('FORUM_EXPORT_UNSUPPORTED_MARKUP');
      const tag = open[1].toLowerCase();
      if (selfClosing && !['img', 'br'].includes(tag))
        throw new Error('FORUM_EXPORT_UNSUPPORTED_MARKUP');
      const attrs = parseAttrs(open[2]);
      if (
        /\/>\s*$/.test(input.slice(i, end + 1)) &&
        !['img', 'br'].includes(tag)
      )
        throw new Error('FORUM_EXPORT_UNSUPPORTED_MARKUP');
      if (tag === 'br') {
        if (Object.keys(attrs).length)
          throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE');
        result.markup.push({ kind: 'br' });
        result.text += '\n';
      } else if (tag === 'img') {
        if (
          Object.keys(attrs).some((a) => !['src', 'alt'].includes(a)) ||
          !attrs.src ||
          attrs.src.length > ATTR_MAX ||
          (attrs.alt?.length ?? 0) > 1024
        )
          throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE');
        const ref = projectForumReference(attrs.src);
        result.resources.push(ref);
        result.markup.push({
          kind: 'image',
          url: ref.kind === 'external' ? ref.url : undefined,
          alt: attrs.alt ?? '',
        });
      } else if (['p', 'strong', 'em', 'code', 'a'].includes(tag)) {
        if (tag === 'a') {
          if (
            Object.keys(attrs).some((a) => a !== 'href') ||
            !attrs.href ||
            attrs.href.length > ATTR_MAX
          )
            throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE');
          const ref = projectForumReference(attrs.href);
          result.resources.push(ref);
          result.markup.push({
            kind: 'link',
            url: ref.kind === 'external' ? ref.url : undefined,
          });
        } else if (Object.keys(attrs).length)
          throw new Error('FORUM_EXPORT_UNSUPPORTED_ATTRIBUTE');
        stack.push(tag);
      } else throw new Error('FORUM_EXPORT_UNSUPPORTED_TAG');
    }
    i = end + 1;
  }
  if (stack.length) throw new Error('FORUM_EXPORT_UNCLOSED_MARKUP');
  if (result.text.length > FORUM_CONTENT_MAX_LENGTH)
    throw new Error('FORUM_EXPORT_CONTENT_LIMIT');
  return result;
}
