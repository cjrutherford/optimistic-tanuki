import { TestBed } from '@angular/core/testing';
import { LessonEditorComponent } from './lesson-editor.component';

describe('LessonEditorComponent', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ imports: [LessonEditorComponent] });
    const fixture = TestBed.createComponent(LessonEditorComponent);
    fixture.componentRef.setInput('title', 'Three pigments');
    fixture.componentRef.setInput('slug', 'three-pigments');
    fixture.componentRef.setInput('body', '# Three pigments');
    fixture.componentRef.setInput('previewHtml', '<h1>Three pigments</h1>');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows what has been written so far', async () => {
    const { element } = await render();
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    expect(textarea.value).toBe('# Three pigments');
  });

  it('reports every keystroke, so nothing has to be saved to be kept', async () => {
    const { fixture, element } = await render();
    const changed = jest.fn();
    fixture.componentInstance.bodyChange.subscribe(changed);
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Start with a warm red.';
    textarea.dispatchEvent(new Event('input'));

    expect(changed).toHaveBeenCalledWith('Start with a warm red.');
  });

  it('reports a change of title', async () => {
    const { fixture, element } = await render();
    const changed = jest.fn();
    fixture.componentInstance.titleChange.subscribe(changed);
    const input = element.querySelector('input') as HTMLInputElement;

    input.value = 'Pigments';
    input.dispatchEvent(new Event('input'));

    expect(changed).toHaveBeenCalledWith('Pigments');
  });

  // The preview comes from the caller precisely so it is the reader's
  // renderer, not a second one that drifts from it.
  it('shows the preview it was handed', async () => {
    const { element } = await render();

    expect(element.querySelector('otlearn-lesson-prose')?.innerHTML).toContain(
      'Three pigments'
    );
  });

  it('says there is nothing to preview rather than showing an empty box', async () => {
    const { element } = await render({ body: '', previewHtml: '' });

    expect(element.textContent).toContain('Nothing written yet');
    expect(element.querySelector('otlearn-lesson-prose')).toBeNull();
  });

  // A slug is part of a URL and is what exercises are matched on, so a bad
  // one fails quietly much later.
  it('warns about a slug with spaces in it', async () => {
    const { element } = await render({ slug: 'three pigments' });

    expect(element.querySelector('.warning')?.textContent).toContain(
      'lowercase letters'
    );
  });

  it('warns about a slug with capitals in it', async () => {
    const { element } = await render({ slug: 'Three-Pigments' });

    expect(element.querySelector('.warning')).not.toBeNull();
  });

  it('warns about a missing slug', async () => {
    const { element } = await render({ slug: '' });

    expect(element.querySelector('.warning')?.textContent).toContain(
      'address is needed'
    );
  });

  it('says nothing about a slug that is fine', async () => {
    const { element } = await render();

    expect(element.querySelector('.warning')).toBeNull();
  });

  it('accepts a slug with digits', async () => {
    const { element } = await render({ slug: 'lesson-01-intro' });

    expect(element.querySelector('.warning')).toBeNull();
  });
});
