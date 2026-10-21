import { SocialCaptureSource } from './account-export-authored.sources';
import {
  accountMatch,
  captureInvalid,
  field as f,
  profileMatch,
  receiptSource,
} from './account-export-receipt.sources';
export const SAFETY_SOURCES = [
  'BusinessPageContent',
  'BusinessThemeContent',
  'CommunitySponsorshipContent',
  'GuardianContentAudit',
  'GuardianPublishedAssetGrant',
  'ContentReport',
  'ContentModerationAction',
] as const;
export function createSafetySources(
  profileTable: string
): SocialCaptureSource[] {
  const owned = (key: string) => profileMatch(profileTable, key);
  const guardianActor = accountMatch('actorUserId'),
    auditDependent = accountMatch('dependentUserId'),
    grantDependent = owned('dependentProfileId');
  return [
    receiptSource({
      source: 'BusinessPageContent',
      table: 'business_page_contents',
      selector: accountMatch('ownerId'),
      fields: {
        ownerId: f.uuid(),
        tier: f.text(),
        subscriptionStatus: f.text(),
        createdAt: f.time(),
        communityId: f.ref(),
        paymentsBusinessPageId: f.ref(true),
      },
    }),
    receiptSource({
      source: 'BusinessThemeContent',
      table: 'business_theme_contents',
      selector:
        'EXISTS (SELECT 1 FROM business_page_contents b WHERE b.id = r."businessPageId" AND lower(btrim(b."ownerId"::text)) = $1)',
      fields: { businessPageId: f.ref() },
    }),
    receiptSource({
      source: 'CommunitySponsorshipContent',
      table: 'community_sponsorship_contents',
      selector: accountMatch('userId'),
      fields: {
        userId: f.uuid(),
        type: f.text(),
        status: f.text(),
        startsAt: f.time(true),
        expiresAt: f.time(true),
        months: f.integer(),
        createdAt: f.time(),
        communityId: f.ref(),
        businessPageId: f.ref(true),
        paymentsSponsorshipId: f.ref(true),
      },
    }),
    receiptSource({
      source: 'GuardianContentAudit',
      table: 'guardian_content_audit',
      selector: `(${guardianActor}) OR (${auditDependent})`,
      fields: {
        appId: f.text(),
        resourceType: f.text(),
        operation: f.text(),
        createdAt: f.time(),
        resourceId: f.ref(),
      },
      extraSelect: [
        `(${guardianActor}) AS "actorMatches"`,
        `(${auditDependent}) AS "dependentMatches"`,
      ],
      transform: (data, row, accountId) => {
        const participation = [];
        if (row['actorMatches'] === true)
          participation.push({ role: 'actor', accountId });
        if (row['dependentMatches'] === true)
          participation.push({ role: 'dependent', accountId });
        if (!participation.length) captureInvalid();
        return { ...data, participation };
      },
    }),
    receiptSource({
      source: 'GuardianPublishedAssetGrant',
      table: 'guardian_published_asset_grant',
      selector: `(${guardianActor}) OR (${grantDependent})`,
      fields: {
        appId: f.text(),
        resourceType: f.text(),
        createdAt: f.time(),
        assetId: f.ref(),
        resourceId: f.ref(),
      },
      extraSelect: [
        `(${guardianActor}) AS "actorMatches"`,
        `CASE WHEN ${grantDependent} THEN lower(r."dependentProfileId"::text) ELSE NULL END AS "matchedDependentId"`,
      ],
      transform: (data, row, accountId) => {
        const participation = [];
        if (row['actorMatches'] === true)
          participation.push({ role: 'actor', accountId });
        if (typeof row['matchedDependentId'] === 'string')
          participation.push({
            role: 'dependent',
            profileId: row['matchedDependentId'],
          });
        if (!participation.length) captureInvalid();
        return {
          ...data,
          participation,
          referenceOnly: true,
          currentAccess: 'not-established',
        };
      },
    }),
    receiptSource({
      source: 'ContentReport',
      table: 'content_report',
      selector: owned('reporterId'),
      fields: {
        reporterId: f.uuid(),
        contentType: f.text(),
        appScope: f.text(),
        reason: f.text(),
        status: f.text(),
        createdAt: f.time(),
        contentId: f.ref(),
        workspaceId: f.ref(true),
      },
    }),
    receiptSource({
      source: 'ContentModerationAction',
      table: 'content_moderation_action',
      selector: owned('actorProfileId'),
      fields: {
        appScope: f.text(),
        action: f.text(),
        subjectType: f.text(),
        actorProfileId: f.uuid(),
        createdAt: f.time(),
        workspaceId: f.ref(true),
        subjectId: f.ref(),
      },
    }),
  ];
}
