// Copied from tools/personality-baseline/capture.mjs. Runs inside the page via page.evaluate.
export function renderedContrastFailures() {
  // Any CSS colour (rgb, oklab, oklch, hsl, color-mix results...) to
  // [r, g, b, a] via a 1x1 canvas, which Chromium converts to sRGB.
  const ctx = Object.assign(document.createElement('canvas'), {
    width: 1,
    height: 1,
  }).getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === 'transparent') return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (fg, bg) =>
    fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
  const lum = (rgb) =>
    rgb
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  // The backgrounds behind `el`: composited background colours, or, when a
  // gradient paints first, each of its colour stops (text is judged against
  // its worst stop).
  const backgrounds = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage.includes('gradient')) {
        const stops = [
          ...cs.backgroundImage.matchAll(
            /(?:rgba?|oklab|oklch|lab|lch|hsla?|color)\([^()]*\)/g
          ),
        ]
          .map((m) => parse(m[0]))
          .filter(Boolean);
        if (stops.length) {
          // What the gradient is painted over: its own background colour,
          // then its ancestors'.
          const under = [];
          for (let u = e; u; u = u.parentElement) {
            const c = parse(getComputedStyle(u).backgroundColor);
            if (c && c[3] > 0) {
              under.push(c);
              if (c[3] >= 1) break;
            }
          }
          let base = [255, 255, 255];
          for (const c of under.reverse()) base = over(c, base);
          // Each stop over that base (a transparent stop is the base showing
          // through), then the translucent layers above the gradient.
          return stops
            .map((stop) => over(stop, base))
            .map((bg) => {
              for (const c of layers.slice().reverse()) bg = over(c, bg);
              return bg;
            });
        }
      }
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let bg = [255, 255, 255];
    for (const c of layers.reverse()) bg = over(c, bg);
    return [bg];
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || !rect.width)
      continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const r = Math.min(...backgrounds(el).map((bg) => ratio(over(fg, bg), bg)));
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const min = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    // Disabled controls are exempt from WCAG contrast.
    if (el.closest('[disabled], [aria-disabled="true"]')) continue;
    if (r < min)
      out.push({
        text: text.slice(0, 40),
        el: `${el.tagName.toLowerCase()}${
          el.classList.length
            ? '.' + [...el.classList].slice(0, 2).join('.')
            : ''
        }`,
        ratio: +r.toFixed(2),
        min,
      });
  }
  return out;
}
