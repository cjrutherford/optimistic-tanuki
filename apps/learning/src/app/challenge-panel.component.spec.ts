import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import {
  ChallengeListItem,
  ChallengesResponse,
  LearningDataService,
} from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';
import { ChallengePanelComponent } from './challenge-panel.component';

describe('ChallengePanelComponent', () => {
  const challenge: ChallengeListItem = {
    id: 'go-01',
    languageId: 'go',
    title: 'Build a greeting',
    description: 'Write a greeting function.',
    starterCode: 'package main',
    hints: ['Start with a function.'],
    points: 10,
    difficulty: 'easy',
    trackId: 'go-foundations',
    trackDisplayName: 'Go Foundations',
    moduleId: 'basics',
    lessonId: 'hello',
    lessonTitle: 'Hello, Go',
    solved: false,
  };

  const response: ChallengesResponse = {
    challenges: [challenge],
    enrolledCount: 1,
    trackDisplayName: 'Go Foundations',
  };

  function render(
    challenges: ReturnType<typeof jest.fn> = jest.fn(() => of(response)),
    person: { name: string } | null = null
  ): {
    fixture: ComponentFixture<ChallengePanelComponent>;
    service: { challenges: typeof challenges };
  } {
    TestBed.configureTestingModule({
      imports: [ChallengePanelComponent],
      providers: [
        {
          provide: LearningDataService,
          useValue: {
            challenges,
            submit: jest.fn(),
          },
        },
        {
          provide: LearningAuthService,
          useValue: { me: () => of(person) },
        },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(ChallengePanelComponent);
    fixture.detectChanges();
    return { fixture, service: { challenges } };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('opens a labelled panel from a distinct Challenges control', () => {
    const { fixture } = render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;
    const panel = element.querySelector('.challenge-panel') as HTMLElement;

    expect(toggle.textContent).toContain('Challenges');
    expect(toggle.getAttribute('aria-controls')).toBe(
      'learning-challenges-panel'
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.getAttribute('aria-hidden')).toBe('true');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.getAttribute('aria-hidden')).toBe('false');
  });

  it('shows a loading state before the challenge request resolves', () => {
    const challenges = jest.fn(() => NEVER);
    const { fixture } = render(challenges);
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading challenges');
  });

  it('shows a retryable error instead of an empty state when loading fails', () => {
    const challenges = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of(response));
    const { fixture } = render(challenges);
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Challenges could not be loaded'
    );
    const retry = fixture.nativeElement.querySelector(
      '.challenge-retry'
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(challenges).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Build a greeting');
  });

  it('keeps browse and sign-in actions visible for anonymous empty results', () => {
    const { fixture } = render(
      jest.fn(() =>
        of({
          challenges: [],
          enrolledCount: 0,
          trackDisplayName: 'Go Foundations',
        })
      )
    );
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Browse courses');
    expect(fixture.nativeElement.textContent).toContain('Sign in');
  });

  it('keeps the complete local route, including query and fragment, for sign-in', () => {
    const { fixture } = render(
      jest.fn(() =>
        of({
          challenges: [],
          enrolledCount: 0,
          trackDisplayName: '',
        })
      )
    );
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', {
      configurable: true,
      value: '/lesson/go?offeringId=published#challenge',
    });

    expect(fixture.componentInstance.currentPath).toBe(
      '/lesson/go?offeringId=published#challenge'
    );
  });

  it('does not offer sign-in as the remedy for an enrolled empty result', () => {
    TestBed.resetTestingModule();
    const { fixture } = render(
      jest.fn(() =>
        of({
          challenges: [],
          enrolledCount: 1,
          trackDisplayName: 'Go Foundations',
        })
      )
    );
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Published courses will add practice here'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Sign in');
  });

  it('shows enrollment browsing without a sign-in prompt for signed-in learners', () => {
    TestBed.resetTestingModule();
    const { fixture } = render(
      jest.fn(() =>
        of({
          challenges: [],
          enrolledCount: 0,
          trackDisplayName: 'Go Foundations',
        })
      ),
      { name: 'Ada' }
    );
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Browse courses');
    expect(fixture.nativeElement.textContent).not.toContain('Sign in');
  });

  it('renders useful metadata and opens the selected challenge from the keyboard', async () => {
    const { fixture } = render();
    const toggle = fixture.nativeElement.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector(
      '.challenge-card'
    ) as HTMLButtonElement;
    expect(card.textContent).toContain('Go Foundations');
    expect(card.textContent).toContain('Hello, Go');
    expect(card.textContent).toContain('10 pts');

    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector(
      'learning-playground-modal'
    ) as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Build a greeting');

    const close = modal.querySelector('.btn-close') as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    expect(document.activeElement).toBe(card);
    expect(
      (
        fixture.nativeElement.querySelector(
          '.challenge-toggle'
        ) as HTMLButtonElement
      ).getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('restores focus and closes on Escape', () => {
    const { fixture } = render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    const panel = element.querySelector('.challenge-panel') as HTMLElement;
    const close = panel.querySelector(
      '.challenge-dismiss'
    ) as HTMLButtonElement;
    close.focus();
    close.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);

    toggle.click();
    fixture.detectChanges();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('restores the challenge card when Escape closes the playground', async () => {
    const { fixture } = render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    const card = element.querySelector('.challenge-card') as HTMLButtonElement;
    card.focus();
    card.click();
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    expect(element.querySelector('learning-playground-modal')).toBeNull();
    const panel = element.querySelector('.challenge-panel') as HTMLElement;
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(document.activeElement).toBe(card);
  });
});
