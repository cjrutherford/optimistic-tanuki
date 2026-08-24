import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LessonMarkdownService } from './lesson-markdown.service';

describe('LessonMarkdownService', () => {
  let service: LessonMarkdownService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LessonMarkdownService);
  });

  describe('markdown', () => {
    it('renders headings, emphasis and lists as HTML', () => {
      const html = service.render(
        '# Goroutines\n\nRun work **concurrently**.\n\n- one\n- two\n'
      );

      expect(html).toContain('<h2');
      expect(html).toContain('Goroutines');
      expect(html).toContain('<strong>concurrently</strong>');
      expect(html).toContain('<li>one</li>');
    });

    it('renders GitHub tables, which the lessons use', () => {
      const html = service.render(
        '| Type | Zero |\n| --- | --- |\n| int | 0 |\n'
      );

      expect(html).toContain('<table>');
      expect(html).toContain('<td>int</td>');
    });

    it('returns an empty string for empty content', () => {
      expect(service.render('')).toBe('');
    });

    // The page supplies the <h1>. A lesson file that opens with its own
    // '# Title' used to produce a second one saying the same thing.
    it('leaves the only h1 to the page, shifting lesson headings down', () => {
      const html = service.render('# Title\n\n## Section\n\n### Detail\n');

      expect(html).not.toContain('<h1');
      expect(html).toContain('<h2>Title</h2>');
      expect(html).toContain('<h3>Section</h3>');
      expect(html).toContain('<h4>Detail</h4>');
    });

    it('does not shift past h6', () => {
      const html = service.render('###### Deep\n');
      expect(html).toContain('<h6>Deep</h6>');
    });

    it('still renders inline markup inside a heading', () => {
      expect(service.render('# Use `fmt`\n')).toContain('<code>fmt</code>');
    });
  });

  describe('highlighting', () => {
    it.each([
      ['go', 'func main() {}'],
      ['rust', 'fn main() {}'],
      ['cpp', 'int main() { return 0; }'],
      ['typescript', 'const a: number = 1;'],
    ])('highlights %s, one of the four tracks', (lang, code) => {
      const html = service.render('```' + lang + '\n' + code + '\n```');
      expect(html).toContain(`language-${lang}`);
      expect(html).toContain('class="token');
    });

    it('resolves the aliases the lessons write fences with', () => {
      expect(service.render('```rs\nfn main() {}\n```')).toContain(
        'language-rust'
      );
      expect(service.render('```ts\nconst a = 1;\n```')).toContain(
        'language-typescript'
      );
    });

    it('ignores extras after the language in a fence', () => {
      expect(
        service.render('```go title="main.go"\nfunc main() {}\n```')
      ).toContain('language-go');
    });

    it('escapes a block whose language it does not know', () => {
      const html = service.render('```brainfuck\n<script>x</script>\n```');

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });

  // render() deliberately returns unsanitized HTML: the binding sanitizes it.
  // These cover the contract that arrangement depends on, because Angular's
  // sanitizer has to strip the dangerous parts WITHOUT stripping the token
  // spans and language classes that highlighting produces.
  describe('once bound through Angular', () => {
    @Component({
      standalone: true,
      template: `<div [innerHTML]="html"></div>`,
    })
    class HostComponent {
      private readonly markdown = inject(LessonMarkdownService);
      markdownSource = '';
      get html() {
        return this.markdown.render(this.markdownSource);
      }
    }

    function bind(markdown: string): string {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.markdownSource = markdown;
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('div')!
        .innerHTML;
    }

    it('keeps the token spans highlighting produced', () => {
      const rendered = bind('```go\nfunc main() {}\n```');

      expect(rendered).toContain('token');
      expect(rendered).toContain('keyword');
    });

    it('keeps the language class on the code block', () => {
      expect(bind('```rust\nfn main() {}\n```')).toContain('language-rust');
    });

    it('keeps ordinary prose structure', () => {
      const rendered = bind('# Title\n\nSome **bold** text.\n\n- a\n- b\n');

      expect(rendered).toContain('<h2');
      expect(rendered).toContain('<strong>bold</strong>');
      expect(rendered).toContain('<li>');
    });

    it('drops script tags', () => {
      const rendered = bind('Hello\n\n<script>alert(1)</script>\n');

      expect(rendered).not.toContain('<script');
      expect(rendered).toContain('Hello');
    });

    it('drops inline event handlers', () => {
      expect(bind('<img src="x" onerror="alert(1)">')).not.toContain('onerror');
    });
  });

  /**
   * marked emits a real <input type="checkbox"> for these, and Angular's
   * sanitizer drops it, which left a done task and an undone one rendering
   * identically. Found by auditing every markdown construct in a browser.
   */
  describe('task lists', () => {
    it('marks a task nobody has done', () => {
      const html = service.render('- [ ] Check the tide');

      expect(html).toContain('task-mark');
      expect(html).toContain('&#9744;');
      expect(html).toContain('Check the tide');
    });

    it('marks a task that is done, differently', () => {
      const html = service.render('- [x] Check the tide');

      expect(html).toContain('&#10003;');
    });

    it('tells the two apart', () => {
      const done = service.render('- [x] Done');
      const notDone = service.render('- [ ] Not done');

      expect(done).not.toBe(notDone);
    });

    // The symbol has to be text, or the sanitizer removes it and both states
    // look the same again.
    it('uses no input element, which would not survive sanitizing', () => {
      expect(service.render('- [x] Done')).not.toContain('<input');
    });

    it('leaves an ordinary list item alone', () => {
      const html = service.render('- Just a bullet');

      expect(html).toContain('<li>Just a bullet</li>');
      expect(html).not.toContain('task-mark');
    });

    it('still renders inline markup inside a task', () => {
      expect(service.render('- [ ] Read **the** table')).toContain(
        '<strong>the</strong>'
      );
    });
  });
});
