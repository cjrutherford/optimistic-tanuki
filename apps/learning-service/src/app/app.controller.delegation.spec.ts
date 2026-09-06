import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * The spec beside this one drives the controller against a real in-memory
 * repository. These pin the wiring itself: every message-pattern handler is a
 * thin forward to AppService, so what matters is that each one reaches the
 * right method with its payload unpacked the way the handler declares it. A
 * handler wired to the wrong service method would otherwise be silent.
 */
describe('AppController delegation', () => {
  let controller: AppController;
  let appService: Record<string, jest.Mock>;

  const methods = [
    'listPublicPrograms',
    'listCatalog',
    'submitAttempt',
    'recordEvaluation',
    'getLesson',
    'listSubjects',
    'listMyOfferings',
    'getOfferingDetail',
    'getProgress',
    'saveProgress',
    'runCode',
    'getDashboard',
    'submitExercise',
    'answerActivity',
    'enrol',
    'withdraw',
    'listEnrolments',
    'createOffering',
    'updateOffering',
    'deleteOffering',
    'getOfferingOwnership',
    'setCoEditors',
  ];

  beforeEach(() => {
    appService = Object.fromEntries(
      methods.map((name) => [name, jest.fn(() => `result:${name}`)])
    );
    controller = new AppController(appService as unknown as AppService);
  });

  it.each<[string, () => unknown, string, unknown[]]>([
    ['listPrograms', () => controller.listPrograms(), 'listPublicPrograms', []],
    [
      'submitAttempt',
      () => controller.submitAttempt({ attemptId: 'a' } as never),
      'submitAttempt',
      [{ attemptId: 'a' }],
    ],
    [
      'listMyOfferings',
      () => controller.listMyOfferings({ profileId: 'p1' }),
      'listMyOfferings',
      ['p1'],
    ],
    [
      'getProgress',
      () => controller.getProgress({ profileId: 'p1' }),
      'getProgress',
      ['p1'],
    ],
    [
      'runCode',
      () => controller.runCode({ activityId: 'act-1', code: 'x=1' }),
      'runCode',
      ['act-1', 'x=1'],
    ],
    [
      'getDashboard',
      () => controller.getDashboard({ profileId: 'p1' }),
      'getDashboard',
      ['p1'],
    ],
    [
      'submitExercise',
      () =>
        controller.submitExercise({
          profileId: 'p1',
          userId: 'u1',
          activityId: 'act-1',
          code: 'x=1',
        }),
      'submitExercise',
      ['p1', 'u1', 'act-1', 'x=1'],
    ],
    [
      'answerActivity',
      () =>
        controller.answerActivity({
          profileId: 'p1',
          userId: 'u1',
          activityId: 'act-1',
          submission: { choice: 2 },
        }),
      'answerActivity',
      ['p1', 'u1', 'act-1', { choice: 2 }],
    ],
    [
      'enrol',
      () => controller.enrol({ profileId: 'p1', offeringId: 'o1' }),
      'enrol',
      ['p1', 'o1'],
    ],
    [
      'withdraw',
      () => controller.withdraw({ profileId: 'p1', offeringId: 'o1' }),
      'withdraw',
      ['p1', 'o1'],
    ],
    [
      'listMyEnrolments',
      () => controller.listMyEnrolments({ profileId: 'p1' }),
      'listEnrolments',
      ['p1'],
    ],
    [
      'createOffering',
      () =>
        controller.createOffering({
          profileId: 'p1',
          input: { title: 'T' } as never,
        }),
      'createOffering',
      ['p1', { title: 'T' }],
    ],
    [
      'updateOffering',
      () =>
        controller.updateOffering({
          offeringId: 'o1',
          patch: { title: 'T' } as never,
        }),
      'updateOffering',
      ['o1', { title: 'T' }],
    ],
    [
      'deleteOffering',
      () => controller.deleteOffering({ offeringId: 'o1' }),
      'deleteOffering',
      ['o1'],
    ],
    [
      'getOfferingOwnership',
      () => controller.getOfferingOwnership({ offeringId: 'o1' }),
      'getOfferingOwnership',
      ['o1'],
    ],
    [
      'setCoEditors',
      () =>
        controller.setCoEditors({
          offeringId: 'o1',
          coEditorProfileIds: ['p2'],
        }),
      'setCoEditors',
      ['o1', ['p2']],
    ],
  ])(
    '%s forwards to the service and returns its result',
    (_case, call, method, args) => {
      const result = call();

      expect(appService[method]).toHaveBeenCalledWith(...args);
      expect(result).toBe(`result:${method}`);
    }
  );

  describe('payload defaulting', () => {
    it.each([
      [
        'listCatalog',
        (body: unknown) => controller.listCatalog(body as never),
        'listCatalog',
      ],
      [
        'listSubjects',
        (body: unknown) => controller.listSubjects(body as never),
        'listSubjects',
      ],
    ])(
      '%s substitutes an empty viewer for a missing payload',
      (_case, call, method) => {
        call(undefined);

        expect(appService[method]).toHaveBeenCalledWith({});
      }
    );

    it('getLesson defaults a missing viewer', () => {
      controller.getLesson({ trackId: 't1', lessonId: 'l1' });

      expect(appService['getLesson']).toHaveBeenCalledWith('t1', 'l1', {});
    });

    it('getOffering defaults a missing viewer', () => {
      controller.getOffering({ offeringId: 'o1' });

      expect(appService['getOfferingDetail']).toHaveBeenCalledWith('o1', {});
    });

    it('recordEvaluation defaults humanOverride to false', () => {
      controller.recordEvaluation({ attemptId: 'a1' } as never);

      expect(appService['recordEvaluation']).toHaveBeenCalledWith({
        attemptId: 'a1',
        humanOverride: false,
      });
    });

    it('recordEvaluation keeps an explicit humanOverride', () => {
      controller.recordEvaluation({
        attemptId: 'a1',
        humanOverride: true,
      } as never);

      expect(appService['recordEvaluation']).toHaveBeenCalledWith(
        expect.objectContaining({ humanOverride: true })
      );
    });

    it('saveProgress sends only the lesson and completion flag', () => {
      controller.saveProgress({
        profileId: 'p1',
        userId: 'u1',
        lessonId: 'l1',
        completed: true,
      });

      // No points and no exercise ids: reading a lesson is not a submission.
      expect(appService['saveProgress']).toHaveBeenCalledWith('p1', 'u1', {
        lessonId: 'l1',
        completed: true,
      });
    });

    it('setOfferingStatus routes through updateOffering as a status patch', () => {
      controller.setOfferingStatus({
        offeringId: 'o1',
        status: 'published' as never,
      });

      expect(appService['updateOffering']).toHaveBeenCalledWith('o1', {
        status: 'published',
      });
    });
  });
});
