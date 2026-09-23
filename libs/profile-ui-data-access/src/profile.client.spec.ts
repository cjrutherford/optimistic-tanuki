import { OptomisitcTanukiAPIService } from './generated/profile';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
const METHODS = [
  'profileAnalyticsControllerGetRecentViewers',
  'profileAnalyticsControllerGetViewStats',
  'profileAnalyticsControllerRecordView',
  'profileControllerBlockUser',
  'profileControllerCreateProfile',
  'profileControllerCreateTimeline',
  'profileControllerDeleteProfile',
  'profileControllerDeleteTimeline',
  'profileControllerGetAllProfiles',
  'profileControllerGetBlockedUsers',
  'profileControllerGetCurrentProfile',
  'profileControllerGetDiscoverableProfiles',
  'profileControllerGetProfileById',
  'profileControllerGetProfileLegacy',
  'profileControllerGetProfilesByIds',
  'profileControllerGetTimeline',
  'profileControllerUnblockUser',
  'profileControllerUpdateProfile',
  'profileControllerUpdateTimeline',
] as const;

describe('generated profile client operations', () => {
  it('exposes all profile operations', () => {
    expect(METHODS).toHaveLength(19);
    for (const method of METHODS) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
