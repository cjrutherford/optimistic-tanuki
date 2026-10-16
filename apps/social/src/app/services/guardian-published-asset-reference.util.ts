const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const EXACT_ASSET_PATH = new RegExp(`^/(?:api/)?asset/(${UUID})$`, 'i');
import DOMPurify from 'isomorphic-dompurify';

/** Extract exact same-origin relative asset URLs from actual HTML URL attributes. */
export function guardianPublishedAssetReferences(content: string): Set<string> {
  const references = new Set<string>();
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'code',
      'img',
      'video',
      'audio',
      'source',
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'controls',
      'width',
      'height',
      'poster',
    ],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  }) as unknown;
  if (
    !sanitized ||
    typeof sanitized !== 'object' ||
    !('querySelectorAll' in sanitized) ||
    typeof (sanitized as DocumentFragment).querySelectorAll !== 'function'
  ) {
    return references;
  }
  const elements = Array.from(
    (sanitized as DocumentFragment).querySelectorAll(
      'img[src], a[href], video[src], video[poster], audio[src], video source[src], audio source[src]'
    )
  ).map((element) => ({
    tagName: element.tagName,
    attributes: {
      src: element.getAttribute('src') ?? undefined,
      href: element.getAttribute('href') ?? undefined,
      poster: element.getAttribute('poster') ?? undefined,
    },
  }));
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    const attribute =
      tag === 'a'
        ? 'href'
        : tag === 'video' && element.attributes.poster
        ? 'poster'
        : 'src';
    const path = element.attributes[attribute];
    if (!path || /[%?#\\]/.test(path)) continue;
    const match = EXACT_ASSET_PATH.exec(path);
    if (match) references.add(match[1].toLowerCase());
  }
  return references;
}
