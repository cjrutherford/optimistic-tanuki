/**
 * A picture for somebody who has not got one.
 *
 * What stood here was a link to placehold.co, which is an external round trip
 * for a grey rectangle. In a container with no route out it does not resolve
 * at all, so everybody without a photo got a broken image rather than a
 * placeholder, and every persona has no photo because a persona telos has no
 * field to hold one.
 *
 * This draws the picture instead: initials on a colour derived from the name,
 * as a data URI. No network, no request, and the same person is the same
 * colour every time, which is most of what an avatar is for.
 */

/**
 * Distinct hues at even spacing, so two names rarely land on the same colour
 * and none of them land on something unreadable behind white text.
 */
const SATURATION = 52;
const LIGHTNESS = 42;

/** Up to two initials: "Patricia P. Project" reads better as PP than as PPP. */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word));
  if (!words.length) return '?';

  const letters = words
    .map((word) => word.replace(/[^a-z0-9]/gi, '').charAt(0))
    .filter(Boolean);
  if (!letters.length) return '?';

  return (letters[0] + (letters[1] ?? '')).toUpperCase();
}

/**
 * A stable hue for a name.
 *
 * Any spreading hash would do. This one is small, has no dependency, and is
 * deterministic across a reload and across the server render, which matters
 * because a colour that changes between the two is a visible flash.
 */
export function hueOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/** An SVG avatar for a name, as a data URI that needs nothing to load it. */
export function avatarFor(name: string): string {
  const initials = initialsOf(name || '');
  const hue = hueOf(name || 'unknown');
  const background = `hsl(${hue} ${SATURATION}% ${LIGHTNESS}%)`;

  // Sized by viewBox rather than pixels, so the img element decides how big it
  // is and one string serves every size on the page.
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img">`,
    `<rect width="100" height="100" rx="50" fill="${background}"/>`,
    `<text x="50" y="50" fill="#fff" font-family="system-ui, sans-serif"`,
    ` font-size="42" font-weight="600" text-anchor="middle"`,
    ` dominant-baseline="central">${escapeForSvg(initials)}</text>`,
    `</svg>`,
  ].join('');

  // encodeURIComponent rather than base64: it survives the same characters,
  // reads as itself when something goes wrong, and needs no btoa, which does
  // not exist during a server render.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeForSvg(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
