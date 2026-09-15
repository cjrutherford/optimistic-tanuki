import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import {
  ChallengeListItem,
  LearningDataService,
  NotEnrolledError,
  NotSignedInError,
} from './learning-data.service';
import { CodeDraftStore } from './code-draft.store';
import {
  ChallengePlaygroundModalComponent,
  challengeFileName,
} from './challenge-playground-modal.component';
import { CodeEditorComponent } from './code-editor.component';

describe('ChallengePlaygroundModalComponent', () => {
  const challenge: ChallengeListItem = {
    id: 'go-01',
    languageId: 'go',
    title: 'Build a greeting',
    description: 'Write a greeting function.',
    starterCode: 'package main',
    hints: [],
    points: 10,
    difficulty: 'easy',
    trackId: 'go-foundations',
    offeringId: 'go-100',
    trackDisplayName: 'Go Foundations',
    moduleId: 'basics',
    lessonId: 'hello',
    lessonTitle: 'Hello, Go',
    solved: false,
  };

  function render(submit: jest.Mock) {
    TestBed.configureTestingModule({
      imports: [ChallengePlaygroundModalComponent],
      providers: [
        provideRouter([]),
        {
          provide: LearningDataService,
          useValue: { submit },
        },
        {
          provide: CodeDraftStore,
          useValue: { read: () => null, write: jest.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(ChallengePlaygroundModalComponent);
    fixture.componentInstance.challenge = challenge;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('offers a sign-in path when submission needs a session', () => {
    const fixture = render(
      jest.fn(() => throwError(() => new NotSignedInError()))
    );

    fixture.componentInstance.runCode();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Please sign in to run and record challenges'
    );
    expect(
      fixture.nativeElement.querySelector('a[routerlink="/sign-in"]')
    ).toBeTruthy();
  });

  it('submits against the selected offering and preserves its full route on sign-in', () => {
    const submit = jest.fn(() => throwError(() => new NotSignedInError()));
    const fixture = render(submit);
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', {
      configurable: true,
      value: '/module/go-foundations/basics/hello?offeringId=go-100#practice',
    });

    fixture.componentInstance.runCode();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledWith('go-01', 'package main', 'go-100');
    expect(fixture.componentInstance.returnTo).toBe(
      '/module/go-foundations/basics/hello?offeringId=go-100#practice'
    );
  });

  it('offers the course path when submission needs enrolment', () => {
    const fixture = render(
      jest.fn(() => throwError(() => new NotEnrolledError('go-100')))
    );

    fixture.componentInstance.runCode();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Please enroll in this course offering'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Open the course and enrol'
    );
  });

  it.each([
    ['typescript', 'main.ts'],
    ['go', 'main.go'],
    ['cpp', 'main.cpp'],
    ['rust', 'main.rs'],
    ['python', 'main.txt'],
  ])('maps %s challenges to a safe filename', (language, filename) => {
    expect(challengeFileName(language)).toBe(filename);
  });

  it('passes the challenge language to the editor and renders its filename', () => {
    const fixture = render(jest.fn());
    fixture.componentInstance.challenge = {
      ...challenge,
      languageId: 'typescript',
    };
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.file-tab')?.textContent
    ).toContain('main.ts');
    const editor = fixture.debugElement.query(By.directive(CodeEditorComponent))
      .componentInstance as CodeEditorComponent;
    expect(editor.language()).toBe('typescript');
  });

  it('includes compiler errors in the terminal transcript', () => {
    const fixture = render(jest.fn());
    fixture.componentInstance.outcome = {
      output: '',
      errors: ['syntax error on line 4', 'expected }'],
    };
    fixture.detectChanges();

    expect(
      fixture.componentInstance.transcript(fixture.componentInstance.outcome)
    ).toContain('syntax error on line 4');
    expect(
      fixture.nativeElement.querySelector('.transcript')?.textContent
    ).toContain('expected }');
  });

  it.each(['ctrlKey', 'metaKey'])(
    'runs the challenge for Enter with %s',
    (modifier) => {
      const submit = jest.fn(() =>
        of({
          output: 'ok',
          errors: [],
          passed: false,
          awardedPoints: 0,
          progress: {
            lessonId: 'hello',
            completed: false,
            completedExerciseIds: [],
            points: 0,
          },
        })
      );
      const fixture = render(submit);
      const dialog = fixture.nativeElement.querySelector(
        '.modal-dialog'
      ) as HTMLElement;

      dialog.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          [modifier]: true,
        })
      );

      expect(submit).toHaveBeenCalledTimes(1);
    }
  );

  it('does not run for plain Enter or while already running', () => {
    const submit = jest.fn(() =>
      of({
        output: 'ok',
        errors: [],
        passed: false,
        awardedPoints: 0,
        progress: {
          lessonId: 'hello',
          completed: false,
          completedExerciseIds: [],
          points: 0,
        },
      })
    );
    const fixture = render(submit);
    const dialog = fixture.nativeElement.querySelector(
      '.modal-dialog'
    ) as HTMLElement;

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(submit).not.toHaveBeenCalled();

    fixture.componentInstance.running = true;
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
      })
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('contains Tab focus within the dialog', async () => {
    const fixture = render(jest.fn());
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector(
      '.modal-dialog'
    ) as HTMLElement;
    const first = dialog.querySelector('.btn-visit') as HTMLButtonElement;
    const last = dialog.querySelector('.btn-run') as HTMLButtonElement;

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(document.activeElement).toBe(last);

    last.focus();
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );
    expect(document.activeElement).toBe(first);
  });

  it('isolates and restores background siblings across its lifecycle', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ChallengePlaygroundModalComponent],
      providers: [
        provideRouter([]),
        {
          provide: LearningDataService,
          useValue: { submit: jest.fn() },
        },
        {
          provide: CodeDraftStore,
          useValue: { read: () => null, write: jest.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(ChallengePlaygroundModalComponent);
    fixture.componentInstance.challenge = challenge;
    const background = document.createElement('main');
    background.setAttribute('aria-hidden', 'false');
    fixture.nativeElement.parentElement?.append(background);

    fixture.detectChanges();

    expect(background.hasAttribute('inert')).toBe(true);
    expect(background.getAttribute('aria-hidden')).toBe('true');

    fixture.destroy();

    expect(background.hasAttribute('inert')).toBe(false);
    expect(background.getAttribute('aria-hidden')).toBe('false');
    background.remove();
  });
});
