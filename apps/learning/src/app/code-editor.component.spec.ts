import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CodeEditorComponent } from './code-editor.component';
import { Diagnostic } from './code-diagnostics';

@Component({
  imports: [CodeEditorComponent],
  template: `<learning-code-editor
    [code]="code()"
    (codeChange)="code.set($event)"
    [language]="language()"
    [diagnostics]="diagnostics()"
    label="Hello, Go code"
  ></learning-code-editor>`,
})
class HostComponent {
  readonly code = signal('package main');
  readonly language = signal('go');
  readonly diagnostics = signal<Diagnostic[]>([]);
}

/**
 * Monaco does not run under jsdom, so what these cover is the fallback: the
 * textarea that renders on the server and stays until the editor takes over.
 * It is the only editor a server render, a failed chunk load or a no-script
 * visitor ever sees, so it has to work on its own.
 */
describe('CodeEditorComponent (fallback)', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    // ngModel writes to the DOM asynchronously.
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      textarea: element.querySelector('textarea') as HTMLTextAreaElement,
      element,
    };
  }

  it('renders a usable textarea before Monaco is anywhere', async () => {
    const { textarea } = await setup();

    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('package main');
  });

  it('labels the textarea for assistive technology', async () => {
    const { textarea } = await setup();

    expect(textarea.getAttribute('aria-label')).toBe('Hello, Go code');
  });

  it('turns off the browser text corrections that ruin code', async () => {
    const { textarea } = await setup();

    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.getAttribute('autocapitalize')).toBe('off');
    expect(textarea.getAttribute('autocorrect')).toBe('off');
  });

  it('reports edits back to the host', async () => {
    const { fixture, host, textarea } = await setup();

    textarea.value = 'package main // edited';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(host.code()).toBe('package main // edited');
  });

  it('shows code the host changed underneath it', async () => {
    const { fixture, host, textarea } = await setup();

    host.code.set('func main() {}');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textarea.value).toBe('func main() {}');
  });

  it('hides the empty Monaco container from assistive technology', async () => {
    const { element } = await setup();
    const container = element.querySelector('.monaco');

    expect(container?.getAttribute('aria-hidden')).toBe('true');
  });

  it('accepts diagnostics without an editor to put them in', async () => {
    const { fixture, host } = await setup();

    expect(() => {
      host.diagnostics.set([
        { line: 3, column: 1, message: 'boom', severity: 'error' },
      ]);
      fixture.detectChanges();
    }).not.toThrow();
  });
});
