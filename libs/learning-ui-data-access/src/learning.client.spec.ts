import { OptomisitcTanukiAPIService } from './generated/learning';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
const METHODS = [
  'learningControllerAnswerActivity',
  'learningControllerCreateOffering',
  'learningControllerDeleteOffering',
  'learningControllerEnrol',
  'learningControllerGetAuthorStatus',
  'learningControllerGetDashboard',
  'learningControllerGetLesson',
  'learningControllerGetMe',
  'learningControllerGetMyCourses',
  'learningControllerGetMyEnrolments',
  'learningControllerGetMyProgress',
  'learningControllerGetOffering',
  'learningControllerListChallenges',
  'learningControllerListPrograms',
  'learningControllerListSubjects',
  'learningControllerOptInAsAuthor',
  'learningControllerRunCode',
  'learningControllerSaveMyProgress',
  'learningControllerSetCoEditors',
  'learningControllerSetOfferingStatus',
  'learningControllerSubmitExercise',
  'learningControllerUpdateOffering',
  'learningControllerWithdraw',
] as const;

describe('generated learning client operations', () => {
  it('exposes all learning operations', () => {
    expect(METHODS).toHaveLength(23);
    for (const method of METHODS) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
