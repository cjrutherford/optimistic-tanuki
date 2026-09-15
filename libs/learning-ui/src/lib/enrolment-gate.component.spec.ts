import { TestBed } from '@angular/core/testing';
import { EnrolmentGateComponent } from './enrolment-gate.component';

describe('EnrolmentGateComponent', () => {
  async function render(
    inputs: Partial<{
      offeringName: string;
      signedIn: boolean | null;
      available: boolean;
      success: boolean;
      hasLessons: boolean;
      busy: boolean;
      error: string;
    }> = {}
  ) {
    TestBed.configureTestingModule({ imports: [EnrolmentGateComponent] });
    const fixture = TestBed.createComponent(EnrolmentGateComponent);
    fixture.componentRef.setInput('offeringName', inputs.offeringName ?? '');
    fixture.componentRef.setInput(
      'signedIn',
      inputs.signedIn === undefined ? true : inputs.signedIn
    );
    fixture.componentRef.setInput('available', inputs.available ?? true);
    fixture.componentRef.setInput('success', inputs.success ?? false);
    fixture.componentRef.setInput('hasLessons', inputs.hasLessons ?? false);
    fixture.componentRef.setInput('busy', inputs.busy ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? '');
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('invites the learner in rather than reporting a failure', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Enrol to start');
    expect(element.textContent).not.toMatch(/error|failed|denied/i);
  });

  it('names the course when it knows it', async () => {
    const { element } = await render({ offeringName: 'Go Foundations' });

    expect(element.textContent).toContain('Go Foundations');
  });

  it('reads sensibly with no course name', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('this course');
  });

  it('says reading stays open, because it does', async () => {
    const { element } = await render();

    expect(element.textContent).toMatch(/reading is open/i);
  });

  it('emits once when the learner enrols', async () => {
    const { fixture, element } = await render();
    const enrolled = jest.fn();
    fixture.componentInstance.enrol.subscribe(enrolled);

    element.querySelector('button')?.click();

    expect(enrolled).toHaveBeenCalledTimes(1);
  });

  it('offers a direct sign-in action to an anonymous learner', async () => {
    const { fixture, element } = await render({ signedIn: false });
    const signIn = jest.fn();
    fixture.componentInstance.signIn.subscribe(signIn);

    element.querySelector('button')?.click();

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.enrol).not.toBeUndefined();
  });

  it('waits for the session before enabling enrolment', async () => {
    const { element } = await render({ signedIn: null });

    expect(element.textContent).toContain('Checking session');
    expect(element.querySelector('button')?.disabled).toBe(true);
  });

  it('shows work in progress and stops a second click', async () => {
    const { element } = await render({ busy: true });

    expect(element.textContent).toContain('Enrolling');
    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(element.querySelector('.gate')?.getAttribute('aria-busy')).toBe(
      'true'
    );
  });

  it('surfaces an error alongside the invitation, not instead of it', async () => {
    const { element } = await render({ error: 'Enrolment is closed' });

    expect(element.textContent).toContain('Enrolment is closed');
    expect(element.textContent).toContain('Enrol to start');
  });

  it('shows a confirmation and continue action after enrolment', async () => {
    const { fixture, element } = await render({
      success: true,
      hasLessons: true,
    });
    const continueToCourse = jest.fn();
    fixture.componentInstance.continue.subscribe(continueToCourse);

    expect(element.textContent).toContain('Enrolment confirmed');
    expect(element.textContent).toContain('Continue to the first lesson');

    element.querySelector('button')?.click();

    expect(continueToCourse).toHaveBeenCalledTimes(1);
  });

  it('keeps unpublished enrolment unavailable and explains why', async () => {
    const { element } = await render({ available: false });

    expect(element.textContent).toContain('Course not open for enrolment');
    expect(element.textContent).toContain('published');
    expect(element.querySelector('button')).toBeNull();
  });
});
