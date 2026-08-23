import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Diagnostic } from './code-diagnostics';

/** Monaco's language ids for the four tracks. */
const MONACO_LANGUAGES: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  go: 'go',
  cpp: 'cpp',
  rust: 'rust',
};

type MonacoApi = typeof import('monaco-editor/esm/vs/editor/editor.api');
type MonacoEditor = ReturnType<MonacoApi['editor']['create']>;

const THEME = 'learning-console';

/** Monaco's rule colours are bare hex digits, with no leading hash. */
function hex(value: string): string {
  return value.replace(/^#/, '');
}

/**
 * The code editor for an exercise.
 *
 * A plain textarea renders first and stays in the DOM. Monaco is browser-only,
 * so it loads after the first render and takes over; the textarea remains as
 * the server-rendered markup and the fallback if the editor never arrives.
 * That keeps the server and client DOM identical at hydration time.
 */
@Component({
  selector: 'learning-code-editor',
  imports: [FormsModule],
  template: `
    <div class="editor" [class.mounted]="mounted()">
      <div
        #host
        class="monaco"
        [attr.aria-hidden]="mounted() ? null : 'true'"
      ></div>
      <textarea
        [ngModel]="code()"
        (ngModelChange)="code.set($event)"
        [attr.aria-label]="label()"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      ></textarea>
    </div>
  `,
  styles: [
    `
      .editor {
        position: relative;
        min-height: 260px;
      }
      .monaco {
        display: none;
        height: 320px;
        border: 1px solid var(--lx-border-strong);
      }
      .editor.mounted .monaco {
        display: block;
      }
      textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-height: 260px;
        padding: 1rem;
        border: 1px solid var(--lx-border-strong);
        background: var(--lx-code);
        color: var(--lx-code-text);
        font: 400 0.82rem/1.6 ui-monospace, monospace;
        resize: vertical;
      }
      .editor.mounted textarea {
        display: none;
      }
    `,
  ],
})
export class CodeEditorComponent {
  readonly code = model<string>('');
  readonly language = input<string>('plaintext');
  readonly diagnostics = input<readonly Diagnostic[]>([]);
  readonly label = input<string>('Code editor');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected readonly mounted = signal(false);

  private monaco?: MonacoApi;
  private editor?: MonacoEditor;
  /** Guards against echoing our own edit back into the editor. */
  private applying = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      void this.mount();
    });

    destroyRef.onDestroy(() => {
      this.editor?.getModel()?.dispose();
      this.editor?.dispose();
    });

    // Push code set from outside (a reset, or a different exercise) into a
    // mounted editor without clobbering the cursor on every keystroke.
    effect(() => {
      const next = this.code();
      const editor = this.editor;
      if (!editor || this.applying) return;
      if (editor.getValue() !== next) editor.setValue(next);
    });

    effect(() => {
      const found = this.diagnostics();
      if (this.monaco && this.editor) this.showDiagnostics(found);
    });

    effect(() => {
      const id = this.monacoLanguage();
      const model = this.editor?.getModel();
      if (this.monaco && model) this.monaco.editor.setModelLanguage(model, id);
    });
  }

  /**
   * Builds Monaco's theme from the app's own tokens, so the editor follows
   * the palette instead of keeping a second copy of it. Monaco needs literal
   * colours, not var() references, hence reading the computed values.
   */
  private defineTheme(monaco: MonacoApi): void {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;

    const background = token('--lx-code', '#050d16');

    monaco.editor.defineTheme(THEME, {
      // The code surface stays dark in both themes, so the base does too.
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': background,
        'editorGutter.background': background,
        'editorLineNumber.foreground': token('--lx-text-faint', '#66849a'),
        'editorLineNumber.activeForeground': token('--lx-accent', '#76e3d0'),
        'editor.lineHighlightBackground': token(
          '--lx-surface-hover',
          '#0d2131'
        ),
      },
      rules: [
        {
          token: 'comment',
          foreground: hex(token('--lx-syn-comment', '#5f7c91')),
        },
        {
          token: 'keyword',
          foreground: hex(token('--lx-syn-keyword', '#7fb2ff')),
        },
        {
          token: 'string',
          foreground: hex(token('--lx-syn-string', '#9fe8b0')),
        },
        {
          token: 'number',
          foreground: hex(token('--lx-syn-number', '#f0c987')),
        },
        {
          token: 'type',
          foreground: hex(token('--lx-syn-function', '#76e3d0')),
        },
      ],
    });
  }

  private monacoLanguage(): string {
    return MONACO_LANGUAGES[this.language()] ?? 'plaintext';
  }

  private async mount(): Promise<void> {
    let monaco: MonacoApi;
    try {
      monaco = await import('monaco-editor/esm/vs/editor/editor.api');
      // Monarch grammars only. These need no web worker, unlike the full
      // language services, so the editor stays light and offline-safe.
      await Promise.all([
        import('monaco-editor/esm/vs/basic-languages/go/go.contribution'),
        import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution'),
        import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'),
        import(
          'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
        ),
      ]);
    } catch {
      // No editor. The textarea is already on screen and still works.
      return;
    }

    this.monaco = monaco;
    this.defineTheme(monaco);

    // Reveal the container before creating the editor. Monaco measures on
    // construction, and a display:none host measures zero, which left its
    // hidden input rendered as a visible grey box over the code.
    this.mounted.set(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );

    this.editor = monaco.editor.create(this.host().nativeElement, {
      value: this.code(),
      language: this.monacoLanguage(),
      theme: THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbersMinChars: 3,
      padding: { top: 12, bottom: 12 },
      tabSize: 4,
      renderLineHighlight: 'line',
      // Nothing here needs the editor web worker, so these stay off.
      wordBasedSuggestions: 'off',
      quickSuggestions: false,
      occurrencesHighlight: 'off',
      links: false,
    });

    this.editor.onDidChangeModelContent(() => {
      this.applying = true;
      this.code.set(this.editor?.getValue() ?? '');
      this.applying = false;
    });

    this.showDiagnostics(this.diagnostics());
  }

  private showDiagnostics(found: readonly Diagnostic[]): void {
    const monaco = this.monaco;
    const model = this.editor?.getModel();
    if (!monaco || !model) return;

    monaco.editor.setModelMarkers(
      model,
      'runner',
      found.map((diagnostic) => ({
        startLineNumber: diagnostic.line,
        endLineNumber: diagnostic.line,
        startColumn: diagnostic.column,
        // Mark to the end of the line: compilers give a start, not a span.
        endColumn: model.getLineMaxColumn(
          Math.min(diagnostic.line, model.getLineCount())
        ),
        message: diagnostic.message,
        severity:
          diagnostic.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Error,
      }))
    );
  }
}
