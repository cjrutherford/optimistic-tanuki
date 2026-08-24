import { TestBed } from '@angular/core/testing';
import { SubjectNavComponent, SubjectNavItem } from './subject-nav.component';

describe('SubjectNavComponent', () => {
  const subjects: SubjectNavItem[] = [
    { subjectId: 'art', displayName: 'Art', courseCount: 2 },
    { subjectId: 'programming', displayName: 'Programming', courseCount: 4 },
  ];

  async function render(
    inputs: Partial<{ subjects: SubjectNavItem[]; selected: string }> = {}
  ) {
    TestBed.configureTestingModule({ imports: [SubjectNavComponent] });
    const fixture = TestBed.createComponent(SubjectNavComponent);
    fixture.componentRef.setInput('subjects', inputs.subjects ?? subjects);
    fixture.componentRef.setInput('selected', inputs.selected ?? '');
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lists every subject the catalog actually contains', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Art');
    expect(element.textContent).toContain('Programming');
  });

  it('offers a way back to everything', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Everything');
  });

  it('counts every course across subjects on the everything chip', async () => {
    const { element } = await render();
    const chips = element.querySelectorAll('button');

    expect(chips[0].textContent).toContain('6');
  });

  it('starts on everything when nothing is chosen', async () => {
    const { element } = await render();

    expect(element.querySelector('button')?.getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('marks the chosen subject as pressed', async () => {
    const { element } = await render({ selected: 'art' });
    const art = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Art')
    );

    expect(art?.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits the subject that was chosen', async () => {
    const { fixture, element } = await render();
    const chosen = jest.fn();
    fixture.componentInstance.select.subscribe(chosen);

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Programming'))
      ?.click();

    expect(chosen).toHaveBeenCalledWith('programming');
  });

  // Empty, not a subject id, so a caller does not have to invent a sentinel.
  it('emits an empty selection for everything', async () => {
    const { fixture, element } = await render({ selected: 'art' });
    const chosen = jest.fn();
    fixture.componentInstance.select.subscribe(chosen);

    element.querySelector('button')?.click();

    expect(chosen).toHaveBeenCalledWith('');
  });

  // A platform with one subject is a normal state, not a broken one.
  it('renders with no subjects at all', async () => {
    const { element } = await render({ subjects: [] });

    expect(element.querySelectorAll('button')).toHaveLength(1);
    expect(element.textContent).toContain('0');
  });
});
