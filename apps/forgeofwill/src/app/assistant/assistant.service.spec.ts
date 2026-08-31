import { TestBed } from '@angular/core/testing';
import { AssistantContextService } from '@optimistic-tanuki/project-ui';

import { AssistantService } from './assistant.service';
import { ProjectService } from '../project/project.service';

/**
 * One thread per persona, and why it is not one thread with a changing name.
 *
 * The whole thread is replayed to the model on every turn. A single thread
 * carried through a switch would feed each persona words another persona said,
 * and would show one name above turns somebody else produced. Both are
 * invisible in a screenshot and obvious the moment somebody switches back.
 */
describe('AssistantService', () => {
  let service: AssistantService;
  let projects: {
    instructAssistantStreaming: jest.Mock;
  };

  /** The last call's arguments, so a test can answer it when it chooses. */
  function lastCall() {
    const calls = projects.instructAssistantStreaming.mock.calls;
    return calls[calls.length - 1];
  }

  /** Completes the run in flight with a plain answer. */
  function answer(said: string, spokenBy?: { id: string; name: string }) {
    const [, , , onEvent] = lastCall();
    onEvent({
      type: 'done',
      result: {
        said,
        used: [],
        awaitingApproval: false,
        model: 'qwen3:8b',
        ...(spokenBy ? { spokenBy: { ...spokenBy, blurb: '' } } : {}),
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    projects = {
      instructAssistantStreaming: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AssistantService,
        { provide: ProjectService, useValue: projects },
        {
          provide: AssistantContextService,
          useValue: { project: () => null },
        },
      ],
    });
    service = TestBed.inject(AssistantService);
  });

  /** A service built from scratch, so what it remembers is what is on disk. */
  function freshService(): AssistantService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AssistantService,
        { provide: ProjectService, useValue: projects },
        { provide: AssistantContextService, useValue: { project: () => null } },
      ],
    });
    return TestBed.inject(AssistantService);
  }

  it('carries the chosen persona on every question', () => {
    service.speakTo({ id: 'p1', name: 'Patricia P. Project' });

    service.ask('how many tasks');

    expect(lastCall()[4]).toBe('p1');
  });

  it('lets the orchestrator choose when nobody has been picked', () => {
    service.ask('how many tasks');

    expect(lastCall()[4]).toBeNull();
  });

  describe('a thread each', () => {
    it('keeps a persona thread intact across a switch and back', () => {
      service.speakTo({ id: 'p1', name: 'Patricia' });
      service.ask('first question');
      answer('first answer');

      service.speakTo({ id: 'p2', name: 'Percy' });
      expect(service.turns()).toEqual([]);

      service.speakTo({ id: 'p1', name: 'Patricia' });
      expect(service.turns().map((t) => t.text)).toEqual([
        'first question',
        'first answer',
      ]);
    });

    it('never replays one persona thread to another', () => {
      // The history argument is what the model is given as the conversation
      // so far. Anything of Patricia's appearing here would be Percy reading
      // words he did not say.
      service.speakTo({ id: 'p1', name: 'Patricia' });
      service.ask('ask patricia');
      answer('patricia answered');

      service.speakTo({ id: 'p2', name: 'Percy' });
      service.ask('ask percy');

      expect(lastCall()[2]).toEqual([]);
    });

    it('starting over clears one thread and leaves the others', () => {
      service.speakTo({ id: 'p1', name: 'Patricia' });
      service.ask('to patricia');
      answer('patricia answered');
      service.speakTo({ id: 'p2', name: 'Percy' });
      service.ask('to percy');
      answer('percy answered');

      service.clear();

      expect(service.turns()).toEqual([]);
      service.speakTo({ id: 'p1', name: 'Patricia' });
      expect(service.turns()).toHaveLength(2);
    });

    it('answers into the thread it was asked in, not the one now open', () => {
      // A switch during a run is refused, but a run can still finish after
      // one, and the answer belongs to whoever was asked.
      service.speakTo({ id: 'p1', name: 'Patricia' });
      service.ask('to patricia');
      answer('patricia answered');
      service.speakTo({ id: 'p2', name: 'Percy' });

      expect(service.turns()).toEqual([]);
    });
  });

  describe('who is speaking', () => {
    it('adopts whoever the orchestrator answered as', () => {
      // Otherwise the next question is answered by whatever the default
      // happens to be at the time, and the panel can never name anybody.
      service.ask('how many tasks');
      answer('twelve', { id: 'p1', name: 'Patricia P. Project' });

      expect(service.persona()).toEqual({
        id: 'p1',
        name: 'Patricia P. Project',
      });
    });

    it('carries the opening thread over to whoever answered it', () => {
      service.ask('how many tasks');
      answer('twelve', { id: 'p1', name: 'Patricia P. Project' });

      expect(service.turns().map((t) => t.text)).toEqual([
        'how many tasks',
        'twelve',
      ]);
    });

    it('refuses to switch while an answer is still in flight', () => {
      service.speakTo({ id: 'p1', name: 'Patricia' });
      service.ask('to patricia');

      service.speakTo({ id: 'p2', name: 'Percy' });

      expect(service.persona()?.id).toBe('p1');
    });

    it('opens as whoever was last chosen', () => {
      service.speakTo({ id: 'p2', name: 'Percy' });

      // A genuinely new service, because injecting again returns the same one
      // and would prove nothing about what is remembered.
      expect(freshService().persona()?.id).toBe('p2');
    });

    it('opens as nobody when nothing was ever chosen', () => {
      expect(freshService().persona()).toBeNull();
    });

    it('opens as nobody rather than throwing on unreadable storage', () => {
      // This app renders on the server too, where there is no localStorage.
      localStorage.setItem('forgeofwill.assistant.persona', 'not json');

      expect(freshService().persona()).toBeNull();
    });
  });
});
