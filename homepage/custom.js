// Homepage hydrates after custom scripts load, so normalize links continuously
// and once more at click time to prevent React from restoring 127.0.0.1.
const normalizeUrlAttribute = (element, attribute) => {
  if (!element) return;
  const href = element.getAttribute(attribute);
  if (!href) return;

  try {
    const url = new URL(href, window.location.origin);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      url.hostname = window.location.hostname;
      element.setAttribute(attribute, url.toString());
    }
  } catch {
    // Ignore non-HTTP links managed by Homepage.
  }
};

const normalizeLinks = (root = document) => {
  root
    .querySelectorAll?.('a[href]')
    .forEach((anchor) => normalizeUrlAttribute(anchor, 'href'));
  root
    .querySelectorAll?.('img[src]')
    .forEach((image) => normalizeUrlAttribute(image, 'src'));
};

normalizeLinks();
new MutationObserver(() => normalizeLinks()).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
document.addEventListener(
  'click',
  (event) => normalizeUrlAttribute(event.target.closest?.('a[href]'), 'href'),
  true
);
