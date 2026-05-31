import { TestBed } from '@angular/core/testing';
import { MarkdownRendererService } from './markdown-renderer.service';

describe('MarkdownRendererService', () => {
  let service: MarkdownRendererService;

  const render = (markdown: string, sourcePath = 'docs/test.md') =>
    service.render(markdown, { sourcePath });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkdownRendererService);
  });

  it('renders sanitized html with heading ids, code blocks, and rewritten internal links', () => {
    const result = service.render(
      [
        '# Workspace Map',
        '',
        '<script>alert("x")</script>',
        '',
        '```ts',
        'const value = 1;',
        '```',
        '',
        '[Read the getting started guide](../getting-started/README.md)',
      ].join('\n'),
      {
        sourcePath: 'docs/architecture/workspace-map.md',
      }
    );

    expect(String(result.html)).toContain('<pre');
    expect(String(result.html)).toContain('id="workspace-map"');
    expect(String(result.html)).not.toContain('<script');
    expect(String(result.html)).toContain(
      'href="/docs/docs/getting-started/readme"'
    );
    expect(result.toc).toEqual([
      { depth: 1, text: 'Workspace Map', id: 'workspace-map' },
    ]);
  });

  it('strips a leading YAML frontmatter block', () => {
    const result = render(
      ['---', 'title: Sample', 'tags: [a, b]', '---', '', '# Hello'].join('\n')
    );
    expect(result.html).not.toContain('title:');
    expect(result.html).toContain('id="hello"');
  });

  it('renders GFM tables with alignment and wrapper', () => {
    const result = render(
      [
        '| Name | Score | Notes |',
        '| :--- | :---: | ---: |',
        '| Ada  | 99    | great |',
        '| Bob  | 80    | ok    |',
      ].join('\n')
    );
    expect(result.html).toContain('class="docs-table-wrap"');
    expect(result.html).toContain('<table class="docs-table">');
    expect(result.html).toContain('<thead>');
    expect(result.html).toContain('class="docs-align-left"');
    expect(result.html).toContain('class="docs-align-center"');
    expect(result.html).toContain('class="docs-align-right"');
    expect(result.html).toContain('<td class="docs-align-left">Ada</td>');
  });

  it('renders images with https src and lazy loading, escaping unsafe src', () => {
    const safe = render('![Badge](https://example.com/b.png)');
    expect(safe.html).toContain('<img');
    expect(safe.html).toContain('class="docs-image"');
    expect(safe.html).toContain('loading="lazy"');
    expect(safe.html).toContain('src="https://example.com/b.png"');

    const unsafe = render('![evil](javascript:alert(1))');
    expect(unsafe.html).not.toContain('<img');
    expect(unsafe.html).toContain('evil');
  });

  it('renders ordered lists, blockquotes, and horizontal rules', () => {
    const result = render(
      ['1. first', '2. second', '', '> quoted line', '', '---'].join('\n')
    );
    expect(result.html).toContain('<ol><li>first</li><li>second</li></ol>');
    expect(result.html).toContain(
      '<blockquote><p>quoted line</p></blockquote>'
    );
    expect(result.html).toContain('<hr class="docs-hr"');
  });

  it('renders bold, italic, strikethrough, and inline code', () => {
    const result = render(
      'A **bold** and *italic* with ~~strike~~ and `code()` here.'
    );
    expect(result.html).toContain('<strong>bold</strong>');
    expect(result.html).toContain('<em>italic</em>');
    expect(result.html).toContain('<del>strike</del>');
    expect(result.html).toContain('<code>code()</code>');
  });

  it('does not treat snake_case identifiers as italic', () => {
    const result = render('Use `foo_bar_baz` and word_inside_word here.');
    expect(result.html).not.toContain('<em>');
  });
});
