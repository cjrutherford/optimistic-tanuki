import { SocialCaptureSource } from './account-export-authored.sources';
import {
  accountMatch,
  captureInvalid,
  field as f,
  profileMatch,
  receiptSource,
  ReceiptFields,
} from './account-export-receipt.sources';
export const COMMUNITY_SOURCES = [
  'Community',
  'CommunityMember',
  'CommunityInvite',
  'CommunityMembershipAudit',
  'CommunityElection',
  'ElectionCandidate',
  'ElectionVote',
] as const;
export function createCommunitySources(
  profileTable: string
): SocialCaptureSource[] {
  const owned = (key: string) => profileMatch(profileTable, key);
  const pair = (
    source: string,
    table: string,
    account: string,
    profile: string,
    fields: ReceiptFields,
    extra = 'TRUE'
  ) =>
    receiptSource({
      source,
      table,
      fields,
      selector: `((${accountMatch(account)}) OR (${owned(
        profile
      )})) AND (${extra})`,
      checks: {
        accountBinding: accountMatch(account),
        profileBinding: owned(profile),
      },
    });
  const inviteActor = accountMatch('inviterId'),
    inviteSubject = accountMatch('inviteeId');
  const auditActor = accountMatch('actorId'),
    auditSubject = owned('subjectId');
  return [
    pair(
      'Community',
      'community',
      'ownerId',
      'ownerProfileId',
      {
        ownerId: f.uuid(),
        ownerProfileId: f.uuid(),
        appScope: f.text(true),
        createdAt: f.time(),
        parentId: f.ref(true),
      },
      'r."isSystemCommunity" = false'
    ),
    pair('CommunityMember', 'community_member', 'userId', 'profileId', {
      communityId: f.ref(),
      userId: f.uuid(),
      profileId: f.uuid(),
      role: f.text(),
      status: f.text(),
      joinedAt: f.time(),
    }),
    receiptSource({
      source: 'CommunityInvite',
      table: 'community_invite',
      selector: `(${inviteActor}) OR (${inviteSubject})`,
      fields: {
        status: f.text(),
        expiresAt: f.time(true),
        createdAt: f.time(),
        communityId: f.ref(),
      },
      extraSelect: [
        `(${inviteActor}) AS "actorMatches"`,
        `(${inviteSubject}) AS "subjectMatches"`,
      ],
      transform: (data, row, accountId) => {
        const participation = [];
        if (row['actorMatches'] === true)
          participation.push({ role: 'inviter', accountId });
        if (row['subjectMatches'] === true)
          participation.push({ role: 'invitee', accountId });
        if (!participation.length) captureInvalid();
        return { ...data, participation };
      },
    }),
    receiptSource({
      source: 'CommunityMembershipAudit',
      table: 'community_membership_audit',
      selector: `(${auditActor}) OR (${auditSubject})`,
      fields: {
        actor: f.text(),
        action: f.text(),
        from: f.text(),
        to: f.text(),
        createdAt: f.time(),
        workspaceId: f.ref(true),
      },
      extraSelect: [
        `(${auditActor}) AS "actorMatches"`,
        `CASE WHEN ${auditSubject} THEN lower(btrim(r."subjectId")) ELSE NULL END AS "matchedSubjectId"`,
      ],
      transform: (data, row, accountId) => {
        const participation = [];
        if (row['actorMatches'] === true)
          participation.push({ role: 'actor', accountId });
        if (typeof row['matchedSubjectId'] === 'string')
          participation.push({
            role: 'subject',
            profileId: row['matchedSubjectId'],
          });
        if (!participation.length) captureInvalid();
        return { ...data, participation };
      },
    }),
    receiptSource({
      source: 'CommunityElection',
      table: 'community_election',
      selector: accountMatch('initiatedBy'),
      fields: {
        initiatedBy: f.uuid(),
        createdAt: f.time(),
        communityId: f.ref(),
      },
    }),
    pair('ElectionCandidate', 'election_candidate', 'userId', 'profileId', {
      userId: f.uuid(),
      profileId: f.uuid(),
      isWithdrawn: f.boolean(),
      nominatedAt: f.time(),
      electionId: f.ref(),
    }),
    pair('ElectionVote', 'election_vote', 'voterId', 'voterProfileId', {
      voterId: f.uuid(),
      voterProfileId: f.uuid(),
      votedAt: f.time(),
      electionId: f.ref(),
      candidateId: f.ref(),
    }),
  ];
}
