import { TestBed } from '@angular/core/testing';
import { OfferingSummaryComponent } from './offering-summary.component';

describe('OfferingSummaryComponent', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ imports: [OfferingSummaryComponent] });
    const fixture = TestBed.createComponent(OfferingSummaryComponent);
    fixture.componentRef.setInput('displayName', 'Go Foundations');
    fixture.componentRef.setInput('lessonCount', 47);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('says what the course is before asking for anything', async () => {
    const { element } = await render({
      description: 'The language, from hello world to concurrency.',
    });

    expect(element.textContent).toContain('Go Foundations');
    expect(element.textContent).toContain('from hello world to concurrency');
  });

  // Description is optional on an offering, so this is a normal state.
  it('admits a course has no description rather than showing a gap', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('no description yet');
  });

  it('shows the track a course belongs to', async () => {
    const { element } = await render({ trackDisplayName: 'Go' });

    expect(element.querySelector('.eyebrow')?.textContent).toContain('Go');
  });

  // An authored course is usually alone in its track, so both names are the
  // same string and printing both reads as a stutter.
  it('does not repeat the course name above itself', async () => {
    const { element } = await render({ trackDisplayName: 'Go Foundations' });

    expect(element.querySelector('.eyebrow')?.textContent?.trim()).toBe(
      'Course'
    );
  });

  it('falls back to a neutral word when the track has no name', async () => {
    const { element } = await render();

    expect(element.querySelector('.eyebrow')?.textContent).toContain('Course');
  });

  it('names the author', async () => {
    const { element } = await render({ authorName: 'Ada' });

    expect(element.textContent).toContain('Ada');
  });

  it('says authorship is not recorded for a course nobody owns', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Not recorded');
  });

  it('lists what has to come first', async () => {
    const { element } = await render({
      prerequisites: [{ offeringId: 'a', displayName: 'Systems Core 100' }],
    });

    expect(element.textContent).toContain('Take these first');
    expect(element.textContent).toContain('Systems Core 100');
  });

  it('says nothing about prerequisites when there are none', async () => {
    const { element } = await render();

    expect(element.textContent).not.toContain('Take these first');
  });

  it('offers enrolment to somebody who is not enrolled', async () => {
    const { fixture, element } = await render();
    const enrolled = jest.fn();
    fixture.componentInstance.enrol.subscribe(enrolled);

    const enrolButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Enrol')
    );
    enrolButton?.click();

    expect(enrolled).toHaveBeenCalledTimes(1);
  });

  it('does not ask somebody already enrolled to enrol again', async () => {
    const { element } = await render({ isEnrolled: true });

    expect(element.textContent).toContain('You are enrolled');
    expect(
      Array.from(element.querySelectorAll('button')).some((button) =>
        button.textContent?.trim().startsWith('Enrol')
      )
    ).toBe(false);
  });

  // The server refuses enrolment in an unpublished course, so offering it
  // here would produce a button that always fails.
  it('does not offer enrolment in a draft', async () => {
    const { element } = await render({ isDraft: true });
    const enrolButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Enrol')
    );

    expect(enrolButton?.disabled).toBe(true);
    expect(element.textContent).toContain(
      'Enrolment opens when this course is published'
    );
  });

  it('marks a draft as one', async () => {
    const { element } = await render({ isDraft: true });

    expect(element.querySelector('.draft')?.textContent).toContain('Draft');
  });

  it('lets a reader open a course they have not enrolled in', async () => {
    const { fixture, element } = await render();
    const opened = jest.fn();
    fixture.componentInstance.open.subscribe(opened);

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Start reading'))
      ?.click();

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('offers to continue once enrolled', async () => {
    const { element } = await render({ isEnrolled: true });

    expect(element.textContent).toContain('Continue');
  });

  // An empty course has nothing to open, so offering it would go nowhere.
  it('does not offer to open a course with no lessons', async () => {
    const { element } = await render({ lessonCount: 0 });

    expect(element.textContent).not.toContain('Start reading');
    expect(element.textContent).toContain('None yet');
  });

  it('shows work in progress and stops a second enrolment', async () => {
    const { element } = await render({ busy: true });
    const enrolButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Enrolling')
    );

    expect(enrolButton?.disabled).toBe(true);
  });

  it('surfaces an error next to the action, not instead of the course', async () => {
    const { element } = await render({ error: 'Enrolment is closed' });

    expect(element.textContent).toContain('Enrolment is closed');
    expect(element.textContent).toContain('Go Foundations');
  });
});
