import { Component, input } from '@angular/core';

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
    `,
  ],
})
export class LessonProseComponent {
  readonly html = input<string>('');
}
