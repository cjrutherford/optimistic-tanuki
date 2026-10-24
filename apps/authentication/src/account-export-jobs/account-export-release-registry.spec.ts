import {
  APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import { AUTHENTICATION_ACCOUNT_EXPORT_SOURCES } from '../account-export-owner/account-export-owner.service';
import { ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY } from './account-export-release-registry';

describe('account export release source registry', () => {
  it('contains exactly the twelve release owners using their authoritative sources', () => {
    expect(Object.keys(ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY).sort()).toEqual(
      [
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
        'forum',
        'workspace',
        'app-configurator',
        'chat-collector',
        'classifieds',
        'payments',
      ].sort()
    );
    expect(ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY).toEqual({
      authentication: AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
      profile: PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      assets: ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      videos: VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      permissions: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      social: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      forum: FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      workspace: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      'app-configurator': APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      'chat-collector': CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      classifieds: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      payments: PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
    for (const sources of Object.values(
      ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY
    )) {
      expect(sources.length).toBeGreaterThan(0);
      expect(new Set(sources).size).toBe(sources.length);
    }
  });
});
