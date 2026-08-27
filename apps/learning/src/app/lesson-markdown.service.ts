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
    const renderCode = (text: string, lang?: string) =>
      this.renderCode(text, lang);

    this.marked.use({
      renderer: {
        code: ({ text, lang }) => renderCode(text, lang),
        /**
         * Task list items, as text rather than as a control.
         *
         * marked emits a real <input type="checkbox">, and Angular's sanitizer
         * drops it, which left a done task and an undone one looking exactly
         * the same. A symbol survives sanitizing and says which is which.
         * Nothing here is interactive: a lesson records progress through the
         * lesson itself, not through a checkbox in its prose.
         */
        listitem({ tokens, task, checked }) {
          const body = this.parser.parse(tokens, false);
          if (!task) return `<li>${body}</li>`;
          return `<li class="task"><span class="task-mark">${
            checked ? '&#10003;' : '&#9744;'
          }</span>${body}</li>`;
        },
        // A method, not an arrow: marked binds `this` to the renderer, which
        // is where the parser needed for inline markup lives.
        heading({ tokens, depth }) {
          // Shifted down one. The page already gives the lesson its <h1>, and
          // most lesson files open with their own '# Title', which left two
          // h1s saying the same thing and no single document outline.
          const level = Math.min(depth + 1, 6);
          return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>`;
        },
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
    const first = (lang ?? '').trim().split(/\s+/)[0]?.toLowerCase();
    if (first === 'mermaid') {
      // Not highlighted, and not a <code> block at all: the render stage
      // looks for this exact class and replaces its content with a diagram.
      // The source has to survive as TEXT content, because Angular's
      // sanitizer strips the <svg> mermaid produces and would strip an
      // attribute holding raw diagram markup just as readily. Escaping it
      // here and letting the browser decode entities back on read is what
      // keeps that survivable.
      return `<pre class="lesson-mermaid">${this.escape(code)}</pre>`;
    }
    const language = this.grammarFor(lang);
    const grammar = language ? Prism.languages[language] : undefined;
    const body = grammar
      ? Prism.highlight(code, grammar, language as string)
      : this.escape(code);
    const className = language ? ` class="language-${language}"` : '';
    // A code block scrolls sideways when a line is long, and a region that
    // scrolls has to be reachable by keyboard or its content is unreadable
    // without a mouse.
    return `<pre${className} tabindex="0"><code${className}>${body}</code></pre>`;
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
