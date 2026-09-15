import { AppController } from './app.controller';
import { LearningAppService } from './app.controller';

interface AppServiceDelegationDouble {
  listPublicPrograms: jest.Mock;
  listCatalog: jest.Mock;
  submitAttempt: jest.Mock;
  recordEvaluation: jest.Mock;
  getLesson: jest.Mock;
  listSubjects: jest.Mock;
  listMyOfferings: jest.Mock;
  getOfferingDetail: jest.Mock;
  getProgress: jest.Mock;
  saveProgress: jest.Mock;
  runCode: jest.Mock;
  getDashboard: jest.Mock;
  submitExercise: jest.Mock;
  answerActivity: jest.Mock;
  listChallenges: jest.Mock;
  enrol: jest.Mock;
  withdraw: jest.Mock;
  listEnrolments: jest.Mock;
  createOffering: jest.Mock;
  updateOffering: jest.Mock;
  deleteOffering: jest.Mock;
  getOfferingOwnership: jest.Mock;
  setCoEditors: jest.Mock;
}

/**
 * The spec beside this one drives the controller against a real in-memory
 * repository. These pin the wiring itself: every message-pattern handler is a
 * thin forward to AppService, so what matters is that each one reaches the
 * right method with its payload unpacked the way the handler declares it. A
 * handler wired to the wrong service method would otherwise be silent.
 */
describe('AppController delegation', () => {
  let controller: AppController;
  let appService: AppServiceDelegationDouble;

  const methods: (keyof AppServiceDelegationDouble)[] = [
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
    'listChallenges',
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
    appService = {
      listPublicPrograms: jest.fn(() => 'result:listPublicPrograms'),
      listCatalog: jest.fn(() => 'result:listCatalog'),
      submitAttempt: jest.fn(() => 'result:submitAttempt'),
      recordEvaluation: jest.fn(() => 'result:recordEvaluation'),
      getLesson: jest.fn(() => 'result:getLesson'),
      listSubjects: jest.fn(() => 'result:listSubjects'),
      listMyOfferings: jest.fn(() => 'result:listMyOfferings'),
      getOfferingDetail: jest.fn(() => 'result:getOfferingDetail'),
      getProgress: jest.fn(() => 'result:getProgress'),
      saveProgress: jest.fn(() => 'result:saveProgress'),
      runCode: jest.fn(() => 'result:runCode'),
      getDashboard: jest.fn(() => 'result:getDashboard'),
      submitExercise: jest.fn(() => 'result:submitExercise'),
      answerActivity: jest.fn(() => 'result:answerActivity'),
      listChallenges: jest.fn(() => 'result:listChallenges'),
      enrol: jest.fn(() => 'result:enrol'),
      withdraw: jest.fn(() => 'result:withdraw'),
      listEnrolments: jest.fn(() => 'result:listEnrolments'),
      createOffering: jest.fn(() => 'result:createOffering'),
      updateOffering: jest.fn(() => 'result:updateOffering'),
      deleteOffering: jest.fn(() => 'result:deleteOffering'),
      getOfferingOwnership: jest.fn(() => 'result:getOfferingOwnership'),
      setCoEditors: jest.fn(() => 'result:setCoEditors'),
    };
    controller = new AppController(appService as LearningAppService);
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
      'runCode',
      () =>
        controller.runCode({
          activityId: 'act-1',
          code: 'x=1',
          profileId: 'p1',
          offeringId: 'o1',
        }),
      'runCode',
      ['act-1', 'x=1', 'p1', 'o1'],
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
          coEditorProfileIds: ['123e4567-e89b-42d3-a456-426614174002'],
        }),
      'setCoEditors',
      ['o1', ['123e4567-e89b-42d3-a456-426614174002']],
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

    it('passes an offering selector when a lesson route carries one', () => {
      controller.getLesson({
        trackId: 't1',
        lessonId: 'l1',
        offeringId: 'o1',
      });

      expect(appService['getLesson']).toHaveBeenCalledWith(
        't1',
        'l1',
        {},
        'o1'
      );
    });

    it('passes the module selector when a lesson route carries one', () => {
      controller.getLesson({
        trackId: 't1',
        lessonId: 'l1',
        offeringId: 'o1',
        moduleId: 'm1',
      });

      expect(appService['getLesson']).toHaveBeenCalledWith(
        't1',
        'l1',
        {},
        'o1',
        'm1'
      );
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

    it('normalizes direct co-editor calls before reaching the service', () => {
      controller.setCoEditors({
        offeringId: 'o1',
        coEditorProfileIds: [
          ' 123e4567-e89b-42d3-a456-426614174002 ',
          '123e4567-e89b-42d3-a456-426614174002',
        ],
      });

      expect(appService.setCoEditors).toHaveBeenCalledWith('o1', [
        '123e4567-e89b-42d3-a456-426614174002',
      ]);
    });

    it('refuses malformed direct co-editor calls without persistence', () => {
      expect(() =>
        controller.setCoEditors({
          offeringId: 'o1',
          coEditorProfileIds: ['not-a-uuid'],
        })
      ).toThrow();

      expect(appService.setCoEditors).not.toHaveBeenCalled();
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
