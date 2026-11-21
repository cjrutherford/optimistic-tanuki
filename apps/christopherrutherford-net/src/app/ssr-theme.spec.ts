import { applyThemeSnapshot } from './ssr-theme';

describe('applyThemeSnapshot', () => {
  afterEach(() => {
    document.getElementById('ssr-theme')?.remove();
    document.documentElement.removeAttribute('data-mode');
    document.body.classList.remove('personality-elegant');
  });

  it('writes variables, root attributes and the body class', () => {
    applyThemeSnapshot(document, {
      variables: { '--background': '#000', '--font-body': '"A", serif' },
      attributes: { 'data-mode': 'dark' },
      bodyClass: 'personality-elegant',
    });

    expect(document.getElementById('ssr-theme')?.textContent).toBe(
      ':root{--background:#000;--font-body:"A", serif;}'
    );
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(document.body.classList).toContain('personality-elegant');
  });

  it('cannot close the style element from a value', () => {
    applyThemeSnapshot(document, {
      variables: { '--x': '</style><script>' },
      attributes: {},
      bodyClass: 'personality-elegant',
    });

    expect(document.getElementById('ssr-theme')?.textContent).not.toContain(
      '</style'
    );
  });
});
