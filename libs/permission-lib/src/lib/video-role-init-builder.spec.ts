import { RoleInitBuilder } from './permission-builder';

describe('RoleInitBuilder video-client defaults', () => {
  it('assigns member and creator roles for a fresh video-client profile', () => {
    const result = new RoleInitBuilder()
      .setScopeName('video-client')
      .setProfile('profile-1')
      .addAppScopeDefaults()
      .build();

    expect(result.assignments).toEqual(
      expect.arrayContaining([
        {
          roleName: 'video_client_member',
          profileId: 'profile-1',
        },
        {
          roleName: 'video_channel_creator',
          profileId: 'profile-1',
        },
      ]),
    );
  });
});
