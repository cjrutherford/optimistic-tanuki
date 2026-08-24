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
