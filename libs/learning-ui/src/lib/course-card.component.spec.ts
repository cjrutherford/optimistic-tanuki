import { TestBed } from '@angular/core/testing';
import { CourseCardComponent } from './course-card.component';

describe('CourseCardComponent', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ imports: [CourseCardComponent] });
    const fixture = TestBed.createComponent(CourseCardComponent);
    fixture.componentRef.setInput('displayName', 'Intro to Watercolour');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the course', async () => {
    const element = await render();

    expect(element.textContent).toContain('Intro to Watercolour');
  });

  // The card used to assume every course had a language above its title.
  it('says nothing above the title when a course varies along nothing', async () => {
    const element = await render();

    expect(element.querySelector('.variant')).toBeNull();
  });

  it('shows the variant when the course has one', async () => {
    const element = await render({ variantLabel: 'Go' });

    expect(element.querySelector('.variant')?.textContent).toContain('Go');
  });

  it('marks a draft as one, so an author can tell theirs apart', async () => {
    const element = await render({ isDraft: true });

    expect(element.querySelector('.draft')?.textContent).toContain('Draft');
  });

  it('does not call a published course a draft', async () => {
    const element = await render({ isDraft: false });

    expect(element.querySelector('.draft')).toBeNull();
  });

  // An empty course is a real state now that a draft starts with nothing.
  it('reads as having no lessons rather than zero lessons', async () => {
    const element = await render({ lessonCount: 0 });

    expect(element.querySelector('.facts')?.textContent).toContain(
      'No lessons yet'
    );
    expect(element.querySelector('.facts')?.textContent).not.toContain('0 les');
  });

  it('counts one lesson in the singular', async () => {
    const element = await render({ lessonCount: 1 });

    expect(element.querySelector('.facts')?.textContent).toContain('1 lesson');
  });

  it('leaves out facts it does not have', async () => {
    const element = await render({ lessonCount: 3 });
    const facts = element.querySelector('.facts')?.textContent ?? '';

    expect(facts).toContain('3 lessons');
    expect(facts).not.toContain('Level');
    expect(facts).not.toContain('credit');
  });

  it('shows level and credits when they are known', async () => {
    const element = await render({ lessonCount: 3, level: 100, credits: 3 });
    const facts = element.querySelector('.facts')?.textContent ?? '';

    expect(facts).toContain('Level 100');
    expect(facts).toContain('3 credits');
  });

  it('credits one credit in the singular', async () => {
    const element = await render({ credits: 1 });

    expect(element.querySelector('.facts')?.textContent).toContain('1 credit');
  });

  it('names the author when there is one', async () => {
    const element = await render({ authorName: 'Ada' });

    expect(element.textContent).toContain('Written by Ada');
  });

  it('says nothing about authorship for the built-in courses', async () => {
    const element = await render();

    expect(element.querySelector('.author')).toBeNull();
  });
});
