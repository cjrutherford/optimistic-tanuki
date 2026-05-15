import { TestBed } from '@angular/core/testing';
import { MarkdownRendererService } from './markdown-renderer.service';

describe('MarkdownRendererService', () => {
  let service: MarkdownRendererService;

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
});
