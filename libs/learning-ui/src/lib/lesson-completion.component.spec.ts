import { TestBed } from '@angular/core/testing';
import { LessonCompletionComponent } from './lesson-completion.component';

/**
 * Progress used to be recorded only as a side effect of passing a code
 * exercise, so a course with no code in it could be enrolled in and read but
 * never progressed through. Most subjects have no code in them.
 */
describe('LessonCompletionComponent', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ imports: [LessonCompletionComponent] });
    const fixture = TestBed.createComponent(LessonCompletionComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('offers a way to record having read a lesson', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Mark as read');
  });

  it('reports it once done', async () => {
    const { element } = await render({ completed: true });

    expect(element.textContent).toContain('Read.');
    expect(element.textContent).not.toContain('Mark as read');
  });

  it('emits true when a learner marks it', async () => {
    const { fixture, element } = await render();
    const toggled = jest.fn();
    fixture.componentInstance.toggle.subscribe(toggled);

    element.querySelector('button')?.click();

    expect(toggled).toHaveBeenCalledWith(true);
  });

  // Marking something read by mistake should not be permanent.
  it('emits false when a learner takes it back', async () => {
    const { fixture, element } = await render({ completed: true });
    const toggled = jest.fn();
    fixture.componentInstance.toggle.subscribe(toggled);

    element.querySelector('.undo')?.dispatchEvent(new Event('click'));

    expect(toggled).toHaveBeenCalledWith(false);
  });

  it('stops a second click while a save is in flight', async () => {
    const { element } = await render({ busy: true });

    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(element.textContent).toContain('Saving');
  });

  it('shows why a save did not stick', async () => {
    const { element } = await render({
      error: 'Enrol in this course to keep your progress.',
    });

    expect(element.textContent).toContain('Enrol in this course');
  });
});
