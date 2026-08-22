import { Injectable } from '@angular/core';
import { Marked } from 'marked';
import Prism from 'prismjs/components/prism-core';

// Grammars for the four tracks. Loading them by side effect keeps Prism's
// registry populated on the server as well as in the browser, so highlighting
// survives server rendering instead of appearing only after hydration.
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';

/** Fence labels the lessons use, mapped onto Prism's grammar names. */
const GRAMMAR_ALIASES: Record<string, string> = {
  golang: 'go',
  rs: 'rust',
  'c++': 'cpp',
  cc: 'cpp',
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  console: 'bash',
  yml: 'yaml',
};

@Injectable({ providedIn: 'root' })
export class LessonMarkdownService {
  private readonly marked = new Marked({
    gfm: true,
    breaks: false,
  });

  constructor() {
    this.marked.use({
      renderer: {
        code: ({ text, lang }) => this.renderCode(text, lang),
      },
    });
  }

  /**
   * Lesson markdown as HTML, with fenced code highlighted.
   *
   * The result is bound through Angular's [innerHTML], which sanitizes it on
   * both the server and the browser. That is deliberately not DOMPurify:
   * isomorphic-dompurify drags in jsdom, which cannot be bundled into the
   * server bundle, and Angular's own sanitizer needs no DOM to run.
   */
  render(markdown: string): string {
    if (!markdown) return '';
    return this.marked.parse(markdown, { async: false }) as string;
  }

  private renderCode(code: string, lang?: string): string {
    const language = this.grammarFor(lang);
    const grammar = language ? Prism.languages[language] : undefined;
    const body = grammar
      ? Prism.highlight(code, grammar, language as string)
      : this.escape(code);
    const className = language ? ` class="language-${language}"` : '';
    return `<pre${className}><code${className}>${body}</code></pre>`;
  }

  private grammarFor(lang?: string): string | undefined {
    if (!lang) return undefined;
    // Fences sometimes carry extras, as in ```go title="main.go".
    const first = lang.trim().split(/\s+/)[0].toLowerCase();
    const name = GRAMMAR_ALIASES[first] ?? first;
    return Prism.languages[name] ? name : undefined;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
