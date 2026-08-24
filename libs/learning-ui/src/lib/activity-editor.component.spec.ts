import { TestBed } from '@angular/core/testing';
import {
  ActivityEditorComponent,
  EditableActivity,
} from './activity-editor.component';

describe('ActivityEditorComponent', () => {
  async function render(activities: EditableActivity[] = []) {
    TestBed.configureTestingModule({ imports: [ActivityEditorComponent] });
    const fixture = TestBed.createComponent(ActivityEditorComponent);
    fixture.componentRef.setInput('activities', activities);
    fixture.detectChanges();
    await fixture.whenStable();
    const changes: EditableActivity[][] = [];
    fixture.componentInstance.activitiesChange.subscribe((next) =>
      changes.push(next)
    );
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      changes,
      button: (label: string) =>
        Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find(
          (candidate) =>
            candidate.getAttribute('aria-label') === label ||
            candidate.textContent?.trim() === label
        ),
    };
  }

  const quiz = (): EditableActivity => ({
    type: 'quiz.mcq',
    id: 'a1',
    prompt: 'Which pigments?',
    options: [
      { id: 'o1', text: 'Red' },
      { id: 'o2', text: 'Blue' },
    ],
    correctOptionIds: ['o1'],
  });

  // The ported courseware could only ever ask a learner to write a program,
  // which is most of why the platform read as a programming site.
  it('offers every kind of work, not just running code', async () => {
    const { element } = await render();
    const labels = Array.from(element.querySelectorAll('.add button')).map(
      (button) => button.textContent?.trim()
    );

    expect(labels).toEqual([
      'Add Written response',
      'Add Multiple choice',
      'Add Project submission',
      'Add Run code',
    ]);
  });

  it('says a course with no activities is still a course', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('can be read without them');
  });

  it('adds a written response', async () => {
    const { button, changes } = await render();

    button('Add Written response')?.click();

    expect(changes[0]).toHaveLength(1);
    expect(changes[0][0].type).toBe('writing.response');
  });

  // Two is the minimum the schema accepts, so starting with one would make
  // every new quiz invalid on arrival.
  it('starts a new quiz with two options', async () => {
    const { button, changes } = await render();

    button('Add Multiple choice')?.click();

    expect(changes[0][0].options).toHaveLength(2);
  });

  it('removes an activity', async () => {
    const { button, changes } = await render([quiz()]);

    button('Remove Multiple choice')?.click();

    expect(changes[0]).toEqual([]);
  });

  it('records the prompt', async () => {
    const { element, changes } = await render([quiz()]);
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'Name two primaries.';
    textarea.dispatchEvent(new Event('input'));

    expect(changes[0][0].prompt).toBe('Name two primaries.');
  });

  it('ticks and unticks a correct answer', async () => {
    const { element, changes } = await render([quiz()]);
    const checkboxes = element.querySelectorAll('input[type="checkbox"]');

    (checkboxes[1] as HTMLInputElement).click();
    expect(changes[0][0].correctOptionIds).toEqual(['o1', 'o2']);

    (checkboxes[0] as HTMLInputElement).click();
    expect(changes[1][0].correctOptionIds).toEqual([]);
  });

  it('adds an option', async () => {
    const { button, changes } = await render([quiz()]);

    button('Add option')?.click();

    expect(changes[0][0].options).toHaveLength(3);
  });

  // A correct answer pointing at an option that no longer exists would make
  // the quiz unanswerable.
  it('forgets a correct answer when its option is removed', async () => {
    const { button, changes } = await render([quiz()]);

    button('Remove option 1')?.click();

    expect(changes[0][0].options).toHaveLength(1);
    expect(changes[0][0].correctOptionIds).toEqual([]);
  });

  it('warns about a quiz with one option', async () => {
    const activity = quiz();
    activity.options = [{ id: 'o1', text: 'Red' }];
    const { element } = await render([activity]);

    expect(element.querySelector('.warning')?.textContent).toContain(
      'at least two options'
    );
  });

  it('warns about a quiz with no correct answer', async () => {
    const activity = quiz();
    activity.correctOptionIds = [];
    const { element } = await render([activity]);

    expect(element.querySelector('.warning')?.textContent).toContain(
      'at least one correct answer'
    );
  });

  it('warns about a blank option', async () => {
    const activity = quiz();
    activity.options = [
      { id: 'o1', text: 'Red' },
      { id: 'o2', text: '  ' },
    ];
    const { element } = await render([activity]);

    expect(element.querySelector('.warning')?.textContent).toContain(
      'needs some text'
    );
  });

  it('says nothing about a quiz that would be accepted', async () => {
    const { element } = await render([quiz()]);

    expect(element.querySelector('.warning')).toBeNull();
  });

  it('reads a comma separated list of what may be handed in', async () => {
    const { element, changes } = await render([
      {
        type: 'project.submission',
        id: 'a2',
        prompt: 'Hand in a painting.',
        artifactTypes: [],
      },
    ]);
    const input = element.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;

    input.value = 'pdf, image , link';
    input.dispatchEvent(new Event('input'));

    expect(changes[0][0].artifactTypes).toEqual(['pdf', 'image', 'link']);
  });

  it('emits a fresh list rather than mutating the one it was given', async () => {
    const given = [quiz()];
    const { button, changes } = await render(given);

    button('Add option')?.click();

    expect(given[0].options).toHaveLength(2);
    expect(changes[0][0]).not.toBe(given[0]);
  });
});
