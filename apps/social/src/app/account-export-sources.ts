import { SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  createAuthoredSources,
  SocialCaptureSource,
} from './account-export-authored.sources';
import { createCommunitySources } from './account-export-community.sources';
import { createPersonalSources } from './account-export-personal.sources';
import { createSafetySources } from './account-export-safety.sources';

export function createSocialAccountExportSources(
  profileTable: string
): SocialCaptureSource[] {
  const sources = [
    ...createAuthoredSources(profileTable),
    ...createPersonalSources(profileTable),
    ...createCommunitySources(profileTable),
    ...createSafetySources(profileTable),
  ];
  if (
    sources.length !== SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.length ||
    sources.some(
      (source, index) =>
        source.source !== SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES[index]
    )
  ) {
    throw new Error('SOCIAL_ACCOUNT_EXPORT_SOURCE_REGISTRY_MISMATCH');
  }
  return sources;
}
