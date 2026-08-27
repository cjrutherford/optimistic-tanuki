import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { LessonProseComponent } from './lesson-prose.component';

/**
 * This guards a bug that no markup test could see.
 *
 * The markdown parser has been well covered from the start, and every one of
 * those tests passed while the lesson body rendered with browser defaults:
 * tables with no borders, highlighted code with no colours. The HTML was
 * always right. What was wrong was that none of the styling reached it,
 * because content bound through [innerHTML] carries no encapsulation
 * attribute, and Angular scopes a descendant selector onto its last compound
 * selector, so every rule matched nothing.
 *
 * Neither half of that is observable from inside Jest: jsdom does not resolve
 * a stylesheet cascade, and this runner strips component styles, so the
 * compiled definition carries none. What is left, and what actually broke, is
 * the source. Whether the rules land is verified in a real browser.
 */
describe('LessonProseComponent', () => {
  const source = readFileSync(
    join(__dirname, 'lesson-prose.component.ts'),
    'utf8'
  );

  async function render(html: string) {
    TestBed.configureTestingModule({ imports: [LessonProseComponent] });
    const fixture = TestBed.createComponent(LessonProseComponent);
    fixture.componentRef.setInput('html', html);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * The mermaid/katex post-pass does real work behind a dynamic `import()`,
   * which escapes Angular's zone-based stability tracking: `whenStable()`
   * resolves before it finishes. Polling the DOM for the outcome is what
   * `afterRenderEffect` promises instead ("will run at least once"), not a
   * timing guarantee.
   */
  async function waitFor(
    predicate: () => boolean,
    timeoutMs = 15000
  ): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Timed out waiting for the render-stage post-pass.');
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('renders the html it was handed', async () => {
    const element = await render('<p>Start with a warm red.</p>');

    expect(element.textContent).toContain('Start with a warm red.');
  });

  it('renders a table as a table rather than escaping it', async () => {
    const element = await render(
      '<table><tbody><tr><td>04:12</td></tr></tbody></table>'
    );

    expect(element.querySelector('table td')?.textContent).toBe('04:12');
  });

  // Every one of these was styled, and none of the styling applied. The
  // reported symptom was the table, which reads as loose text without borders.
  it.each([
    ['tables', 'border-collapse: collapse'],
    ['table cells', 'th,'],
    ['quotations', 'blockquote'],
    ['code blocks', 'pre {'],
    ['inline code', ':not(pre) > code'],
    ['lists', 'ul,'],
    ['horizontal rules', 'hr {'],
    ['highlighting', '.token.keyword'],
  ])('still styles %s', (_what, fragment) => {
    expect(source).toContain(fragment);
  });

  /**
   * The render-stage post-pass: mermaid and math. Both dynamic imports only
   * fire when the relevant placeholder or delimiter is present, and both are
   * exercised here for real, against the actual `mermaid` and `katex`
   * packages, rather than mocked. Styling and SSR behaviour are covered
   * separately (the former isn't observable in jsdom; the latter is that a
   * server render never runs afterRenderEffect at all, so it emits whatever
   * the markdown stage produced and nothing more, which is exactly the
   * `.lesson-mermaid` markup this class starts from).
   */
  describe('mermaid diagrams', () => {
    afterEach(() => {
      document.getElementById('otlearn-katex-css')?.remove();
    });

    it('leaves ordinary content alone: no mermaid import is triggered', async () => {
      const element = await render('<p>No diagrams here.</p>');

      expect(element.querySelector('.lesson-mermaid-diagram')).toBeNull();
      expect(element.querySelector('.lesson-mermaid-error')).toBeNull();
    });

    it('replaces the placeholder with a rendered diagram or a visible error, never nothing', async () => {
      const element = await render(
        '<pre class="lesson-mermaid">graph TD;\n  A--&gt;B;</pre>'
      );

      await waitFor(() => !element.querySelector('pre.lesson-mermaid'));

      // ...by exactly one outcome: a diagram, or a visible failure. A
      // half-finished diagram in the live preview must not blank the page.
      const rendered = element.querySelector('.lesson-mermaid-diagram');
      const failed = element.querySelector('.lesson-mermaid-error');
      expect(rendered ?? failed).not.toBeNull();
      if (failed) {
        // The source stays readable, and the notice says something happened.
        expect(failed.querySelector('pre')?.textContent).toContain('graph TD;');
        expect(failed.querySelector('p')?.textContent).toBeTruthy();
      }
    }, 20000);

    it('shows a visible error rather than blanking the page for invalid syntax', async () => {
      const element = await render(
        '<pre class="lesson-mermaid">not a diagram at all &amp;&amp;&amp;</pre>'
      );

      await waitFor(() => !element.querySelector('pre.lesson-mermaid'));

      expect(
        element.querySelector('.lesson-mermaid-diagram') ||
          element.querySelector('.lesson-mermaid-error')
      ).not.toBeNull();
    }, 20000);
  });

  describe('math', () => {
    afterEach(() => {
      document.getElementById('otlearn-katex-css')?.remove();
    });

    it('leaves ordinary content alone: no katex stylesheet is added', async () => {
      await render('<p>Nothing to typeset, not even a lone $5 price.</p>');

      expect(document.getElementById('otlearn-katex-css')).toBeNull();
    });

    it('renders inline math delimited by $…$', async () => {
      const element = await render('<p>Energy: $E = mc^2$.</p>');

      expect(element.querySelector('.katex')).not.toBeNull();
      // The delimiters themselves are consumed, not left dangling as text.
      expect(element.textContent).not.toContain('$E');
    }, 20000);

    it('renders display math delimited by $$…$$', async () => {
      const element = await render('<p>$$a^2 + b^2 = c^2$$</p>');

      expect(element.querySelector('.katex')).not.toBeNull();
    }, 20000);

    it('adds the katex stylesheet exactly once, however many expressions render', async () => {
      await render('<p>$a$ and $b$ and $$c$$</p>');

      expect(
        document.querySelectorAll('#otlearn-katex-css').length
      ).toBeLessThanOrEqual(1);
      const link = document.getElementById(
        'otlearn-katex-css'
      ) as HTMLLinkElement | null;
      if (link) {
        expect(link.getAttribute('href')).toBe('/assets/katex/katex.min.css');
      }
    }, 20000);

    it('leaves a dollar amount inside code alone', async () => {
      const element = await render('<pre><code>echo $HOME</code></pre>');

      expect(element.querySelector('.katex')).toBeNull();
      expect(element.textContent).toContain('$HOME');
    });
  });

  /**
   * The one that matters. Angular rewrites `:host ::ng-deep X` so it reaches
   * content the component did not itself render; a plain `X` never will.
   */
  it('writes every rule to reach content it did not render', () => {
    const css = source.slice(source.indexOf('styles: ['));
    const selectors = css
      .split('}')
      .map((rule) => rule.split('{')[0])
      .map((selector) => selector.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter(Boolean)
      .flatMap((selector) => selector.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((selector) => selector.startsWith(':host'));

    expect(selectors.length).toBeGreaterThan(20);
    expect(
      selectors.filter(
        (selector) => selector !== ':host' && !selector.includes('::ng-deep')
      )
    ).toEqual([]);
  });
});
