import * as fs from 'fs';
import * as path from 'path';

const seedData = require('../assets/default-permissions.json');

describe('video-client permission seeds', () => {
  const shellSeedPath = path.resolve(process.cwd(), 'seed-permissions.sh');
  const shellSeed = fs.readFileSync(shellSeedPath, 'utf8');

  it('defines the video-client app scope and expected roles in default-permissions.json', () => {
    expect(
      seedData.app_scopes.some((scope: { name: string }) => scope.name === 'video-client')
    ).toBe(true);

    expect(
      seedData.roles.some((role: { name: string; appScope: string }) =>
        role.name === 'video_client_member' && role.appScope === 'video-client'
      )
    ).toBe(true);

    expect(
      seedData.roles.some((role: { name: string; appScope: string }) =>
        role.name === 'video_channel_creator' && role.appScope === 'video-client'
      )
    ).toBe(true);
  });

  it('defines video management and community participation permissions for video-client', () => {
    const expectedPermissions = [
      'videos.channel.create',
      'videos.channel.update',
      'videos.channel.delete',
      'videos.video.create',
      'videos.video.update',
      'videos.video.delete',
      'videos.schedule.create',
      'videos.schedule.update',
      'videos.schedule.delete',
      'videos.live.start',
      'videos.live.stop',
      'community.join',
      'community.leave',
      'community.read',
      'social.post.create',
      'social.post.read',
      'social.comment.create',
      'social.vote.create',
      'social.reaction.create',
      'social.reaction.read',
    ];

    for (const permission of expectedPermissions) {
      expect(
        seedData.permissions.some(
          (entry: { name: string; appScope: string }) =>
            entry.name === permission && entry.appScope === 'video-client'
        )
      ).toBe(true);
    }
  });

  it('maps creator and member roles to the expected video-client permissions', () => {
    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'video_channel_creator' &&
          entry.permission === 'videos.schedule.create' &&
          entry.permissionAppScope === 'video-client'
      )
    ).toBe(true);

    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'video_channel_creator' &&
          entry.permission === 'videos.live.start' &&
          entry.permissionAppScope === 'video-client'
      )
    ).toBe(true);

    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'video_client_member' &&
          entry.permission === 'community.join' &&
          entry.permissionAppScope === 'video-client'
      )
    ).toBe(true);

    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'video_client_member' &&
          entry.permission === 'social.post.create' &&
          entry.permissionAppScope === 'video-client'
      )
    ).toBe(true);
  });

  it('keeps the shell seed script aligned with the video-client permission model', () => {
    expect(shellSeed).toContain("('video-client', 'Video platform");
    expect(shellSeed).toContain("('video_client_member'");
    expect(shellSeed).toContain("('video_channel_creator'");
    expect(shellSeed).toContain("('videos.schedule.create'");
    expect(shellSeed).toContain("('videos.live.start'");
  });
});
