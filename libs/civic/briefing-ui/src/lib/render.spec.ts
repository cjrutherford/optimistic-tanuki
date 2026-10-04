import { renderBriefing } from './render';

/** Parses rendered HTML so assertions are about elements, not text. */
function parse(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('briefing rendering', () => {
  it("drops the briefing's own title, which the masthead already shows", () => {
    const html = renderBriefing(
      '# Tifton, GA — daily briefing, 2026-09-17\n\n7 new items.\n\n## New today\n\n- one'
    );
    expect(html).not.toMatch(/<h1/u);
    expect(html).toMatch(/<p>7 new items.<\/p>/u);
    expect(html).toMatch(/<h2[^>]*>New today<\/h2>/u);
  });

  it('turns raw HTML in a quoted headline into text, whatever it contains', () => {
    const root = parse(
      renderBriefing(
        [
          '- **<img src=x onerror="alert(1)">** [source](javascript:alert(2))',
          '- <script>alert(3)</script> <iframe src="https://evil.example"></iframe>',
          '- <a href="https://ok.example" onclick="alert(4)">fine</a>',
        ].join('\n')
      )
    );
    expect(root.querySelectorAll('img, script, iframe').length).toBe(0);
    const links = Array.from(root.querySelectorAll('a'));
    expect(links).toEqual([]);
    for (const element of Array.from(root.querySelectorAll('*')))
      for (const attribute of element.getAttributeNames())
        expect(attribute.startsWith('on')).toBe(false);
    // Shown as written, so a reader sees what the headline said.
    expect(root.textContent).toContain('<script>alert(3)</script>');
  });

  it('keeps the collapsed coverage block', () => {
    const html = renderBriefing(
      '<details>\n<summary>Coverage gaps (3)</summary>\n\n- a\n\n</details>'
    );
    expect(html).toMatch(/<details>/u);
    expect(html).toMatch(/<summary>Coverage gaps \(3\)<\/summary>/u);
    expect(parse(html).querySelector('details li')?.textContent).toBe('a');
  });

  it('keeps a link to a story file the site does not serve as text, not a broken link', () => {
    const html = renderBriefing(
      '*Full story: [Interim superintendent](../../stories/tifton-ga/evidence-698.md)*'
    );
    expect(html).not.toMatch(/href=/u);
    expect(html).toMatch(/Interim superintendent/u);
  });

  it('opens sources in a new tab that learns nothing about the reader', () => {
    const link = parse(
      renderBriefing('[source](https://tiftongazette.com/story "The Gazette")')
    ).querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://tiftongazette.com/story');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('title')).toBe('The Gazette');
  });

  it('keeps no picture, only its description', () => {
    const root = parse(
      renderBriefing('![Council chamber](https://x.example/a.jpg)')
    );
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Council chamber');
  });
});
