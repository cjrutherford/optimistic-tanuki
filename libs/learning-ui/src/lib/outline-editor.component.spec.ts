import { TestBed } from '@angular/core/testing';
import {
  OutlineEditorComponent,
  OutlineModule,
} from './outline-editor.component';

describe('OutlineEditorComponent', () => {
  const outline = (): OutlineModule[] => [
    {
      id: 'm1',
      title: 'Pigments',
      lessons: [
        { id: 'l1', title: 'Three pigments', slug: 'three', body: 'words' },
        { id: 'l2', title: 'Mixing', slug: 'mixing', body: '' },
      ],
    },
    { id: 'm2', title: 'Paper', lessons: [] },
  ];

  async function render(modules: OutlineModule[] = outline()) {
    TestBed.configureTestingModule({ imports: [OutlineEditorComponent] });
    const fixture = TestBed.createComponent(OutlineEditorComponent);
    fixture.componentRef.setInput('modules', modules);
    fixture.detectChanges();
    await fixture.whenStable();
    const changes: OutlineModule[][] = [];
    fixture.componentInstance.outlineChange.subscribe((next) =>
      changes.push(next)
    );
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      changes,
      button: (label: string) =>
        Array.from(fixture.nativeElement.querySelectorAll('button')).find(
          (candidate) =>
            (candidate as HTMLButtonElement).getAttribute('aria-label') ===
              label ||
            (candidate as HTMLButtonElement).textContent?.trim() === label
        ) as HTMLButtonElement | undefined,
    };
  }

  it('shows the structure as it stands', async () => {
    const { element } = await render();

    // Module titles are editable fields, so they live in values rather than
    // in text. Lessons are buttons, so they are text.
    expect(
      Array.from(element.querySelectorAll('.module-title')).map(
        (input) => (input as HTMLInputElement).value
      )
    ).toEqual(['Pigments', 'Paper']);
    expect(element.textContent).toContain('Three pigments');
    expect(element.textContent).toContain('Mixing');
  });

  // A course with an outline but no words in it is a normal mid-writing state,
  // and the author needs to see which lessons are still empty.
  it('marks a lesson nobody has written yet', async () => {
    const { element } = await render();

    expect(element.querySelectorAll('.unwritten')).toHaveLength(1);
  });

  it('says an empty course needs a module', async () => {
    const { element } = await render([]);

    expect(element.textContent).toContain('No modules yet');
  });

  it('adds a module', async () => {
    const { button, changes } = await render();

    button('Add module')?.click();

    expect(changes[0]).toHaveLength(3);
  });

  it('adds a lesson to the module it was asked for', async () => {
    const { button, changes } = await render();

    button('Add lesson')?.click();

    expect(changes[0][0].lessons).toHaveLength(3);
    expect(changes[0][1].lessons).toHaveLength(0);
  });

  it('selects a lesson the moment it is added, so it can be written', async () => {
    const { fixture, button } = await render();
    const selected = jest.fn();
    fixture.componentInstance.selectLesson.subscribe(selected);

    button('Add lesson')?.click();

    expect(selected).toHaveBeenCalledWith({ moduleIndex: 0, lessonIndex: 2 });
  });

  it('removes a module', async () => {
    const { button, changes } = await render();

    button('Remove Paper')?.click();

    expect(changes[0].map((module) => module.title)).toEqual(['Pigments']);
  });

  it('removes a lesson', async () => {
    const { button, changes } = await render();

    button('Remove Mixing')?.click();

    expect(changes[0][0].lessons.map((lesson) => lesson.title)).toEqual([
      'Three pigments',
    ]);
  });

  // Order is what an outline is for.
  it('moves a module down', async () => {
    const { button, changes } = await render();

    button('Move Pigments down')?.click();

    expect(changes[0].map((module) => module.title)).toEqual([
      'Paper',
      'Pigments',
    ]);
  });

  it('moves a lesson up', async () => {
    const { button, changes } = await render();

    button('Move Mixing up')?.click();

    expect(changes[0][0].lessons.map((lesson) => lesson.title)).toEqual([
      'Mixing',
      'Three pigments',
    ]);
  });

  it('will not move the first thing up', async () => {
    const { button } = await render();

    expect(button('Move Pigments up')?.disabled).toBe(true);
  });

  it('will not move the last thing down', async () => {
    const { button } = await render();

    expect(button('Move Paper down')?.disabled).toBe(true);
  });

  // The lesson being written should follow its own move, not stay on whatever
  // slid into that position.
  it('keeps the selection on the lesson that moved', async () => {
    TestBed.configureTestingModule({ imports: [OutlineEditorComponent] });
    const fixture = TestBed.createComponent(OutlineEditorComponent);
    fixture.componentRef.setInput('modules', outline());
    fixture.componentRef.setInput('selected', {
      moduleIndex: 0,
      lessonIndex: 1,
    });
    fixture.detectChanges();
    const selected = jest.fn();
    fixture.componentInstance.selectLesson.subscribe(selected);

    (
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button')
      ).find(
        (candidate) => candidate.getAttribute('aria-label') === 'Move Mixing up'
      ) as HTMLButtonElement
    ).click();

    expect(selected).toHaveBeenCalledWith({ moduleIndex: 0, lessonIndex: 0 });
  });

  it('renames a module', async () => {
    const { element, changes } = await render();
    const input = element.querySelector('.module-title') as HTMLInputElement;

    input.value = 'Pigments and paper';
    input.dispatchEvent(new Event('input'));

    expect(changes[0][0].title).toBe('Pigments and paper');
  });

  it('emits a fresh outline rather than mutating the one it was given', async () => {
    const given = outline();
    const { button, changes } = await render(given);

    button('Add module')?.click();

    expect(given).toHaveLength(2);
    expect(changes[0]).not.toBe(given);
    expect(changes[0][0]).not.toBe(given[0]);
  });
});
