import { TestBed } from '@angular/core/testing';
import {
  ActivityAnswerComponent,
  AnswerableActivity,
  AnswerMark,
} from './activity-answer.component';

describe('ActivityAnswerComponent', () => {
  const mcq: AnswerableActivity = {
    type: 'quiz.mcq',
    id: 'q1',
    prompt: 'Which is a cool colour?',
    options: [
      { id: 'o1', text: 'Ultramarine' },
      { id: 'o2', text: 'Cadmium red' },
    ],
  };

  const written: AnswerableActivity = {
    type: 'writing.response',
    id: 'w1',
    prompt: 'What is the range, and how do you know?',
  };

  async function render(
    activity: AnswerableActivity,
    inputs: Partial<{
      mark: AnswerMark | null;
      busy: boolean;
      error: string;
    }> = {}
  ) {
    TestBed.configureTestingModule({ imports: [ActivityAnswerComponent] });
    const fixture = TestBed.createComponent(ActivityAnswerComponent);
    fixture.componentRef.setInput('activity', activity);
    fixture.componentRef.setInput('mark', inputs.mark ?? null);
    fixture.componentRef.setInput('busy', inputs.busy ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? '');
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      button: (label: string) =>
        Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find((candidate) => candidate.textContent?.trim() === label),
    };
  }

  it('asks the question the author wrote', async () => {
    const { element } = await render(mcq);

    expect(element.textContent).toContain('Which is a cool colour?');
  });

  it('offers the options to choose from', async () => {
    const { element } = await render(mcq);

    expect(element.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  });

  it('will not answer until something is chosen', async () => {
    const { button } = await render(mcq);

    expect(button('Answer')?.disabled).toBe(true);
  });

  it('sends the chosen options', async () => {
    const { fixture, element, button } = await render(mcq);
    const answered = jest.fn();
    fixture.componentInstance.answer.subscribe(answered);

    (element.querySelectorAll('input')[0] as HTMLInputElement).click();
    fixture.detectChanges();
    button('Answer')?.click();

    expect(answered).toHaveBeenCalledWith(['o1']);
  });

  // A multiple choice can have more than one right answer.
  it('allows more than one choice', async () => {
    const { fixture, element, button } = await render(mcq);
    const answered = jest.fn();
    fixture.componentInstance.answer.subscribe(answered);

    (element.querySelectorAll('input')[0] as HTMLInputElement).click();
    (element.querySelectorAll('input')[1] as HTMLInputElement).click();
    fixture.detectChanges();
    button('Answer')?.click();

    expect(answered).toHaveBeenCalledWith(['o1', 'o2']);
  });

  it('sends prose for a written answer', async () => {
    const { fixture, element, button } = await render(written);
    const answered = jest.fn();
    fixture.componentInstance.answer.subscribe(answered);
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = '  The range is 4.3 m.  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Answer')?.click();

    expect(answered).toHaveBeenCalledWith('The range is 4.3 m.');
  });

  it('counts words when the author set a limit', async () => {
    const { fixture, element } = await render({ ...written, maxWords: 50 });
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'one two three';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.textContent).toContain('3 of 50 words');
  });

  it('shows the mark once there is one', async () => {
    const { element } = await render(mcq, {
      mark: { graded: true, score: 1, maxScore: 1, feedback: 'Correct.' },
    });

    expect(element.textContent).toContain('1 / 1');
    expect(element.textContent).toContain('Correct.');
  });

  // Answering twice would let somebody grind for a better mark.
  it('does not offer to answer again once marked', async () => {
    const { button, element } = await render(mcq, {
      mark: { graded: true, score: 0, maxScore: 1, feedback: 'Not quite.' },
    });

    expect(button('Answer')).toBeUndefined();
    expect((element.querySelector('input') as HTMLInputElement).disabled).toBe(
      true
    );
  });

  /**
   * A rubric mark is several judgements, not one number. A learner who lost a
   * mark should see which criterion it was.
   */
  it('breaks a rubric mark down by criterion', async () => {
    const { element } = await render(written, {
      mark: {
        graded: true,
        score: 3,
        maxScore: 5,
        feedback: 'Most of the way there.',
        criteria: [
          {
            id: 'reads-row',
            description: 'Reads a time and height.',
            maxPoints: 3,
            points: 3,
            evidenceFound: true,
            comment: 'Read both correctly.',
          },
          {
            id: 'range',
            description: 'Explains the range.',
            maxPoints: 2,
            points: 0,
            evidenceFound: false,
            comment: '',
          },
        ],
      },
    });

    expect(element.textContent).toContain('Reads a time and height.');
    expect(element.textContent).toContain('3/3');
    expect(element.textContent).toContain('0/2');
    expect(element.querySelectorAll('.criteria li.missed')).toHaveLength(1);
  });

  // An unmarked answer is recorded, not lost, and should not look like a zero.
  it('shows an unmarked answer without a score', async () => {
    const { element } = await render(written, {
      mark: {
        graded: false,
        feedback:
          'Your answer has been recorded. This one is marked by a person.',
      },
    });

    expect(element.textContent).toContain('marked by a person');
    expect(element.querySelector('.score')).toBeNull();
  });

  it('shows work in progress while marking', async () => {
    const { fixture, element, button } = await render(mcq, { busy: true });
    (element.querySelectorAll('input')[0] as HTMLInputElement).click();
    fixture.detectChanges();

    expect(button('Marking…')?.disabled).toBe(true);
  });

  it('surfaces an error next to the action', async () => {
    const { element } = await render(mcq, { error: 'Enrol to answer.' });

    expect(element.textContent).toContain('Enrol to answer.');
  });

  it('says a project is handed in elsewhere rather than offering a box', async () => {
    const { element, button } = await render({
      type: 'project.submission',
      id: 'p1',
      prompt: 'Hand in a painting.',
    });

    expect(element.textContent).toContain('handed in outside the site');
    expect(button('Answer')).toBeUndefined();
  });
});
