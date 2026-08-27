import {
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
} from '@angular/core';

/** A KaTeX delimiter probe, cheap enough to run on every render pass. */
const MATH_DELIMITER = /\$\$[\s\S]+?\$\$|\$[^\n$]+\$/;

/** The stylesheet mermaid diagrams and math need, served as a static asset
 * (see apps/learning/project.json) rather than bundled, so its fonts resolve
 * by plain relative URL and neither library costs anything until a lesson
 * actually uses it. */
const KATEX_CSS_HREF = '/assets/katex/katex.min.css';
const KATEX_CSS_ID = 'otlearn-katex-css';

/**
 * Lesson text, rendered.
 *
 * One component owns lesson typography so a writer's preview and a reader's
 * page cannot drift apart. The editor previously styled only its container,
 * so a table in a preview rendered as a run of loose text while the same
 * table on the lesson page had borders.
 *
 * Everything here is written with ::ng-deep, and has to be. The HTML arrives
 * through [innerHTML], so none of it carries Angular's encapsulation
 * attribute, and Angular scopes a descendant selector onto its last compound
 * selector. Without piercing, every one of these rules matches nothing: that
 * was true of the lesson page for its whole life, which is why tables had no
 * borders and highlighted code had no colours despite the markup being right.
 *
 * The HTML is bound as a plain string rather than as trusted HTML, so
 * Angular's sanitizer runs over it on the server and in the browser.
 */
@Component({
  selector: 'otlearn-lesson-prose',
  template: `<div [innerHTML]="html()"></div>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        color: var(--lx-text-body, currentColor);
        line-height: 1.7;
        overflow-wrap: break-word;
      }
      :host ::ng-deep :first-child {
        margin-top: 0;
      }
      :host ::ng-deep h1,
      :host ::ng-deep h2,
      :host ::ng-deep h3,
      :host ::ng-deep h4 {
        margin: 2rem 0 0.6rem;
        color: var(--lx-text);
        letter-spacing: -0.02em;
        line-height: 1.25;
        text-wrap: balance;
      }
      :host ::ng-deep h1 {
        font-size: 1.8rem;
      }
      :host ::ng-deep h2 {
        font-size: 1.4rem;
      }
      :host ::ng-deep h3 {
        font-size: 1.13rem;
      }
      :host ::ng-deep h4 {
        font-size: 1rem;
      }
      :host ::ng-deep p,
      :host ::ng-deep ul,
      :host ::ng-deep ol,
      :host ::ng-deep blockquote,
      :host ::ng-deep table {
        margin: 0 0 1rem;
      }
      :host ::ng-deep ul,
      :host ::ng-deep ol {
        padding-left: 1.35rem;
      }
      /* Task list items carry their state as a symbol, because a real
         checkbox does not survive Angular's sanitizer. */
      :host ::ng-deep li.task {
        list-style: none;
        margin-left: -1.1rem;
      }
      :host ::ng-deep .task-mark {
        display: inline-block;
        width: 1.1rem;
        color: var(--lx-accent, currentColor);
      }
      :host ::ng-deep li {
        margin-bottom: 0.35rem;
      }
      :host ::ng-deep a {
        color: var(--lx-accent);
      }
      :host ::ng-deep strong {
        color: var(--lx-text);
      }
      :host ::ng-deep blockquote {
        padding: 0.2rem 0 0.2rem 1rem;
        border-left: 3px solid var(--lx-border-strong);
        color: var(--lx-text-muted);
      }
      :host ::ng-deep hr {
        margin: 2rem 0;
        border: 0;
        border-top: 1px solid var(--lx-border);
      }
      :host ::ng-deep table {
        display: block;
        width: 100%;
        overflow-x: auto;
        border-collapse: collapse;
        font-size: 0.87rem;
      }
      :host ::ng-deep th,
      :host ::ng-deep td {
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--lx-border);
        text-align: left;
      }
      :host ::ng-deep th {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      /* Inline code, but not the code inside a highlighted block. */
      :host ::ng-deep :not(pre) > code {
        padding: 0.12em 0.4em;
        border-radius: 3px;
        background: var(--lx-inline-code);
        color: var(--lx-accent-soft);
        font: 400 0.85em var(--lx-font-mono, ui-monospace, monospace);
      }
      :host ::ng-deep pre {
        margin: 0 0 1.15rem;
        padding: 0.95rem 1.1rem;
        overflow-x: auto;
        border: 1px solid var(--lx-border-strong);
        border-left: 3px solid var(--lx-border-accent);
        background: var(--lx-code);
        color: var(--lx-code-text);
        font: 400 0.83rem/1.65 var(--lx-font-mono, ui-monospace, monospace);
      }
      :host ::ng-deep pre code {
        background: none;
        padding: 0;
        font: inherit;
      }

      /* Prism tokens, tuned to this app's console palette. */
      :host ::ng-deep .token.comment,
      :host ::ng-deep .token.prolog,
      :host ::ng-deep .token.doctype,
      :host ::ng-deep .token.cdata {
        color: var(--lx-syn-comment);
        font-style: italic;
      }
      :host ::ng-deep .token.punctuation {
        color: var(--lx-syn-punct);
      }
      :host ::ng-deep .token.keyword,
      :host ::ng-deep .token.rule,
      :host ::ng-deep .token.important {
        color: var(--lx-syn-keyword);
      }
      :host ::ng-deep .token.string,
      :host ::ng-deep .token.char,
      :host ::ng-deep .token.attr-value {
        color: var(--lx-syn-string);
      }
      :host ::ng-deep .token.number,
      :host ::ng-deep .token.boolean,
      :host ::ng-deep .token.constant,
      :host ::ng-deep .token.symbol {
        color: var(--lx-syn-number);
      }
      :host ::ng-deep .token.function,
      :host ::ng-deep .token.class-name {
        color: var(--lx-accent);
      }
      :host ::ng-deep .token.operator,
      :host ::ng-deep .token.entity,
      :host ::ng-deep .token.url {
        color: var(--lx-syn-operator);
      }
      :host ::ng-deep .token.property,
      :host ::ng-deep .token.tag,
      :host ::ng-deep .token.attr-name,
      :host ::ng-deep .token.builtin {
        color: var(--lx-syn-property);
      }
      :host ::ng-deep .token.deleted {
        color: var(--lx-danger);
      }

      /* Mermaid. The placeholder <pre> is the SSR/no-JS fallback: raw
         diagram source, monospaced, scrolling sideways rather than
         overflowing the page. Once rendered in the browser it is replaced
         by a wrapper carrying the SVG, which gets the same scroll
         treatment because a wide diagram is exactly as likely as a long
         code line. */
      :host ::ng-deep pre.lesson-mermaid {
        white-space: pre-wrap;
        word-break: break-word;
      }
      :host ::ng-deep .lesson-mermaid-diagram {
        display: block;
        margin: 0 0 1.15rem;
        padding: 0.95rem;
        overflow-x: auto;
        border: 1px solid var(--lx-border-strong);
        border-left: 3px solid var(--lx-border-accent);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface);
        text-align: center;
      }
      :host ::ng-deep .lesson-mermaid-diagram svg {
        max-width: 100%;
      }
      :host ::ng-deep .lesson-mermaid-error {
        margin: 0 0 1.15rem;
        padding: 0.95rem 1.1rem;
        border: 1px solid var(--lx-danger);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well);
      }
      :host ::ng-deep .lesson-mermaid-error pre {
        margin: 0 0 0.5rem;
        overflow-x: auto;
        color: var(--lx-code-text);
        font: 400 0.83rem/1.5 var(--lx-font-mono, ui-monospace, monospace);
      }
      :host ::ng-deep .lesson-mermaid-error p {
        margin: 0;
        color: var(--lx-danger);
        font-size: 0.85rem;
      }

      /* KaTeX. Its own stylesheet supplies the fonts and glyph layout; this
         only keeps a display equation from overflowing a narrow viewport. */
      :host ::ng-deep .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0.2rem 0;
      }
    `,
  ],
})
export class LessonProseComponent {
  readonly html = input<string>('');

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private mermaidSeq = 0;

  constructor() {
    afterRenderEffect(() => {
      // Read the signal so this effect re-runs whenever the lesson body
      // (or the author's live preview of it) changes.
      this.html();
      void this.enhance();
    });
  }

  /**
   * The post-pass that runs after Angular has bound (and sanitized) the
   * lesson HTML. Everything here writes to the DOM directly through
   * `nativeElement`, bypassing Angular's sanitizer the same way any native
   * browser API would — never by trusting the lesson HTML itself.
   *
   * afterRenderEffect only runs in the browser, so this never touches the
   * DOM during SSR; the server emits whatever the markdown stage produced
   * (a plain, readable `<pre>` of diagram source, and untouched math
   * delimiters) and that is the fallback until this pass runs.
   */
  private async enhance(): Promise<void> {
    const root = this.elementRef.nativeElement;
    // Neither pass may ever throw out of here: this runs fire-and-forget
    // from an afterRenderEffect (see the constructor), and an unhandled
    // rejection there would abandon whichever placeholders had not been
    // replaced yet, leaving them stuck looking broken instead of falling
    // back to the readable source they started as.
    await this.renderMermaid(root);
    await this.renderMath(root);
  }

  private async renderMermaid(root: HTMLElement): Promise<void> {
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('pre.lesson-mermaid')
    );
    if (!nodes.length) return;

    // Failure to even load mermaid (a bad deploy, an offline preview) is
    // handled the same way a single bad diagram is: every placeholder gets
    // the visible-error treatment below, rather than an unhandled rejection
    // that would leave them all stuck as unrendered source forever.
    let mermaid: Awaited<typeof import('mermaid')>['default'] | undefined;
    try {
      const mod = await import('mermaid');
      mod.default.initialize({
        startOnLoad: false,
        // The mitigation that makes writing mermaid's output straight into
        // the DOM acceptable for user-generated lesson content: strict mode
        // sanitizes diagram labels and disables click/link handlers.
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: this.mermaidThemeVariables(),
      });
      mermaid = mod.default;
    } catch {
      mermaid = undefined;
    }

    for (const node of nodes) {
      const source = node.textContent ?? '';
      const container = document.createElement('div');
      container.className = 'lesson-mermaid-diagram';
      try {
        if (!mermaid) throw new Error('mermaid unavailable');
        const id = `otlearn-mermaid-${++this.mermaidSeq}`;
        const { svg } = await mermaid.render(id, source);
        // A native DOM assignment, not an Angular binding: Angular's
        // sanitizer never sees this string, which is the only way an <svg>
        // survives (constraint: the sanitizer strips <svg> outright).
        container.innerHTML = svg;
      } catch {
        // A half-finished diagram in the live preview must not blank the
        // page. Show the source and a short notice instead of throwing.
        container.classList.remove('lesson-mermaid-diagram');
        container.classList.add('lesson-mermaid-error');
        const pre = document.createElement('pre');
        pre.textContent = source;
        const message = document.createElement('p');
        message.textContent = 'This diagram could not be rendered.';
        container.append(pre, message);
      }
      node.replaceWith(container);
    }
  }

  /**
   * Walks text nodes looking for `$…$` and `$$…$$` rather than using KaTeX's
   * own `contrib/auto-render`: that entry point ships with no declaration
   * file (unlike the package root), and a hand-rolled ambient `.d.ts` for it
   * would need to live somewhere every consumer's TypeScript program
   * actually includes, which a library-local file is not guaranteed to be.
   * `katex`'s root export is fully typed, so building on `renderToString`
   * keeps this typed end to end.
   */
  private async renderMath(root: HTMLElement): Promise<void> {
    if (!MATH_DELIMITER.test(root.textContent ?? '')) return;

    // If katex fails to load, the delimited text is left exactly as the
    // markdown stage wrote it: readable, just untypeset. No error to show,
    // and nothing worth throwing over.
    let katex: Awaited<typeof import('katex')>['default'];
    try {
      katex = (await import('katex')).default;
    } catch {
      return;
    }
    this.ensureKatexStylesheet();

    const skippedParent = new Set([
      'SCRIPT',
      'NOSCRIPT',
      'STYLE',
      'TEXTAREA',
      'PRE',
      'CODE',
    ]);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent && skippedParent.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return MATH_DELIMITER.test(node.textContent ?? '')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    const targets: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      targets.push(node as Text);
    }
    for (const textNode of targets) {
      this.renderMathInTextNode(textNode, katex);
    }
  }

  private renderMathInTextNode(
    textNode: Text,
    katex: { renderToString: (tex: string, options?: object) => string }
  ): void {
    const text = textNode.data;
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^\n$]+)\$/g;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let matched = false;

    while ((match = pattern.exec(text))) {
      matched = true;
      if (match.index > lastIndex) {
        fragment.append(text.slice(lastIndex, match.index));
      }
      const display = match[1] !== undefined;
      const expression = (display ? match[1] : match[2]) ?? '';
      const span = document.createElement(display ? 'div' : 'span');
      // A native DOM assignment: the string KaTeX returns is its own
      // sanitized-by-construction markup (throwOnError/trust below), never
      // the lesson body itself, so Angular's sanitizer is not in play here
      // any more than it is for the mermaid diagram it sits beside.
      span.innerHTML = katex.renderToString(expression, {
        throwOnError: false,
        // Lesson math is user-generated content; leaving `trust` at its
        // default (false) is what keeps a command like \includegraphics
        // from doing anything.
        trust: false,
        displayMode: display,
      });
      fragment.append(span);
      lastIndex = pattern.lastIndex;
    }

    if (!matched) return;
    if (lastIndex < text.length) {
      fragment.append(text.slice(lastIndex));
    }
    textNode.replaceWith(fragment);
  }

  private ensureKatexStylesheet(): void {
    if (document.getElementById(KATEX_CSS_ID)) return;
    const link = document.createElement('link');
    link.id = KATEX_CSS_ID;
    link.rel = 'stylesheet';
    link.href = KATEX_CSS_HREF;
    document.head.appendChild(link);
  }

  /** Mermaid themed to match `--lx-*`, so a diagram looks native in both the
   * light and dark theme rather than carrying mermaid's own default palette.
   * The literal second argument to each read is only a fallback for the
   * moment before the theme stylesheet has applied; it repeats that same
   * token's own value, the way `learning-theme.scss` itself falls back. */
  private mermaidThemeVariables(): Record<string, string> {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;

    return {
      background: token('--lx-surface', '#091622'),
      fontFamily: token('--lx-font-mono', 'ui-monospace, monospace'),
      primaryColor: token('--lx-surface-active', '#123047'),
      primaryTextColor: token('--lx-text', '#eaf3fa'),
      primaryBorderColor: token('--lx-border-strong', '#365674'),
      secondaryColor: token('--lx-surface-hover', '#0d2131'),
      tertiaryColor: token('--lx-well', '#06101c'),
      lineColor: token('--lx-border-accent', '#3d7f96'),
      textColor: token('--lx-text-body', '#d5e7f6'),
      mainBkg: token('--lx-surface-active', '#123047'),
      nodeBorder: token('--lx-border-strong', '#365674'),
      clusterBkg: token('--lx-well', '#06101c'),
      clusterBorder: token('--lx-border', '#294b62'),
      edgeLabelBackground: token('--lx-surface', '#091622'),
      actorBkg: token('--lx-surface-active', '#123047'),
      actorBorder: token('--lx-border-strong', '#365674'),
      actorTextColor: token('--lx-text', '#eaf3fa'),
      signalColor: token('--lx-text-muted', '#a9bed2'),
      signalTextColor: token('--lx-text-body', '#d5e7f6'),
      labelBoxBkgColor: token('--lx-surface', '#091622'),
      labelTextColor: token('--lx-text', '#eaf3fa'),
      errorBkgColor: token('--lx-danger', '#d98b6a'),
      errorTextColor: token('--lx-text', '#eaf3fa'),
    };
  }
}
