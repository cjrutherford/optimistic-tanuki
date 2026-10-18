import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportParticipantSnapshot,
  ACCOUNT_EXPORT_CONTRACT_VERSION,
  ACCOUNT_EXPORT_PREVIEW_BUDGETS,
} from '@optimistic-tanuki/models';
import type { OwnedAccountProfileIdPageRequest } from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { In, Repository } from 'typeorm';
import validator from 'validator';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';

const PAGE_SIZE = 100;
const MAX_PROFILE_PAGES = 100;
const MAX_PROFILE_IDS = PAGE_SIZE * MAX_PROFILE_PAGES;
const MAX_ASSIGNMENTS = 1000;
const RPC_TIMEOUT_MS = 3000;
const MAX_TOTAL_READ_TIME_MS = 30_000;
const MAX_STRING = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxStringFieldCharacters;
const MAX_BYTES = ACCOUNT_EXPORT_PREVIEW_BUDGETS.maxParticipantSerializedBytes;
const ASSIGNMENT_FIELDS = [
  'id',
  'profileId',
  'roleId',
  'appScopeId',
  'created_at',
] as const;

const oversizedString = (value: unknown): boolean => {
  if (typeof value === 'string') return value.length > MAX_STRING;
  if (Array.isArray(value)) return value.some(oversizedString);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.values(value).some(oversizedString);
  }
  return false;
};

@Injectable()
export class AccountExportService {
  constructor(
    @Inject(getRepositoryToken(RoleAssignment))
    private readonly assignmentRepository: Repository<RoleAssignment>,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy
  ) {}

  async getAccountExportSnapshot(
    accountId: unknown,
    token: unknown,
    appId: unknown
  ): Promise<
    AccountExportParticipantSnapshot<{
      assignments: Array<Record<string, unknown>>;
    }>
  > {
    if (typeof accountId !== 'string' || !validator.isUUID(accountId, 4)) {
      throw new RpcException('Invalid account export subject');
    }
    await this.assertAuthenticatedSubject(accountId, token, appId);

    const uncovered = [
      'permissions-role-assignment-preview',
      'profile-id-pages-unfenced',
      'shared-role-scope-permission-definitions-uncovered',
      'target-resources-uncovered',
    ];
    const assignments: Array<Record<string, unknown>> = [];
    const seenProfiles = new Set<string>();
    const seenAssignments = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    let profileCount = 0;
    let identityFailed = false;
    let assignmentReadFailed = false;
    let malformed = false;
    let truncatedProfiles = false;
    let truncatedAssignments = false;
    let timeBudgetExceeded = false;
    let continued = true;
    const startedAt = Date.now();

    while (continued) {
      if (Date.now() - startedAt >= MAX_TOTAL_READ_TIME_MS) {
        timeBudgetExceeded = true;
        break;
      }
      if (pages >= MAX_PROFILE_PAGES || profileCount >= MAX_PROFILE_IDS) {
        truncatedProfiles = true;
        break;
      }
      let page: unknown;
      try {
        const request: OwnedAccountProfileIdPageRequest = {
          accountId,
          token: token as string,
          appId: appId as string,
          ...(cursor ? { afterId: cursor } : {}),
          limit: PAGE_SIZE,
        };
        page = await firstValueFrom(
          this.profileClient
            .send(
              { cmd: ProfileCommands.GetOwnedAccountProfileIdPage },
              request
            )
            .pipe(timeout({ first: RPC_TIMEOUT_MS }))
        );
      } catch {
        identityFailed = true;
        break;
      }
      if (!this.isValidPage(page, accountId, cursor)) {
        identityFailed = true;
        malformed = true;
        break;
      }
      const validPage = page as {
        profileIds: string[];
        hasMore: boolean;
        nextCursor: string | null;
      };
      const ids = validPage.profileIds;
      if (
        ids.length > PAGE_SIZE ||
        profileCount + ids.length > MAX_PROFILE_IDS
      ) {
        truncatedProfiles = true;
        break;
      }
      for (const id of ids) {
        if (seenProfiles.has(id)) {
          malformed = true;
          break;
        }
        seenProfiles.add(id);
      }
      if (malformed) break;
      profileCount += ids.length;
      pages += 1;

      if (ids.length > 0) {
        const remaining = MAX_ASSIGNMENTS - assignments.length;
        if (remaining <= 0) {
          truncatedAssignments = true;
          break;
        }
        let rows: RoleAssignment[];
        try {
          rows = await this.assignmentRepository.find({
            where: { profileId: In(ids) },
            select: [...ASSIGNMENT_FIELDS],
            order: { id: 'ASC' },
            take: remaining + 1,
            loadEagerRelations: false,
          });
        } catch {
          assignmentReadFailed = true;
          break;
        }
        if (rows.length > remaining) truncatedAssignments = true;
        let previousAssignmentId = '';
        for (const row of rows.slice(0, remaining)) {
          if (
            !ids.includes(row.profileId) ||
            !validator.isUUID(row.id, 4) ||
            (previousAssignmentId && row.id <= previousAssignmentId) ||
            seenAssignments.has(row.id)
          ) {
            malformed = true;
            continue;
          }
          seenAssignments.add(row.id);
          previousAssignmentId = row.id;
          assignments.push({
            id: row.id,
            profileId: row.profileId,
            roleId: row.roleId,
            appScopeId: row.appScopeId ?? null,
            created_at: row.created_at,
          });
        }
      }
      if (truncatedAssignments) break;
      continued = validPage.hasMore;
      if (continued) {
        cursor = validPage.nextCursor ?? undefined;
      }
    }

    if (identityFailed) uncovered.push('profile-id-page-invalid');
    if (assignmentReadFailed) uncovered.push('role-assignment-read-failed');
    if (malformed)
      uncovered.push('profile-or-assignment-row-malformed-or-foreign');
    if (truncatedProfiles) uncovered.push('profile-id-preview-limit-exceeded');
    if (truncatedAssignments)
      uncovered.push('role-assignment-preview-limit-exceeded');
    if (timeBudgetExceeded)
      uncovered.push('permission-preview-time-budget-exceeded');

    let data: { assignments: Array<Record<string, unknown>> } = { assignments };
    let serializedSizeExceeded = false;
    if (oversizedString(data)) {
      uncovered.push('permission-preview-string-limit-exceeded');
      data = { assignments: [] };
      serializedSizeExceeded = true;
    }
    const snapshot = {
      contractVersion: ACCOUNT_EXPORT_CONTRACT_VERSION,
      participantId: 'permissions',
      accountId,
      status: 'partial' as const,
      uncovered,
      data,
    };
    if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_BYTES) {
      uncovered.push('permission-preview-response-budget-exceeded');
      data = { assignments: [] };
      serializedSizeExceeded = true;
    }
    if (serializedSizeExceeded)
      uncovered.push('permission-preview-data-omitted-for-budget');
    return { ...snapshot, uncovered, data };
  }

  private async assertAuthenticatedSubject(
    accountId: string,
    token: unknown,
    appId: unknown
  ): Promise<void> {
    if (
      typeof token !== 'string' ||
      token.trim() === '' ||
      typeof appId !== 'string' ||
      appId.trim() === ''
    ) {
      throw new RpcException('Invalid account export session');
    }
    let response: { isValid?: boolean; data?: { userId?: string } };
    try {
      response = await firstValueFrom(
        this.authClient
          .send(
            { cmd: AuthCommands.Validate },
            { token, userId: accountId, appId }
          )
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch {
      throw new RpcException('Invalid account export session');
    }
    if (response?.isValid !== true || response.data?.userId !== accountId) {
      throw new RpcException('Invalid account export session');
    }
  }

  private isValidPage(
    page: unknown,
    accountId: string,
    cursor?: string
  ): boolean {
    if (!page || typeof page !== 'object') return false;
    const candidate = page as Record<string, unknown>;
    if (
      candidate.accountId !== accountId ||
      candidate.unfenced !== true ||
      !Array.isArray(candidate.profileIds) ||
      typeof candidate.hasMore !== 'boolean' ||
      !(
        candidate.nextCursor === null ||
        (typeof candidate.nextCursor === 'string' &&
          validator.isUUID(candidate.nextCursor, 4))
      )
    )
      return false;
    const ids = candidate.profileIds;
    let previous = cursor ?? '';
    for (const id of ids) {
      if (
        typeof id !== 'string' ||
        !validator.isUUID(id, 4) ||
        (previous && id <= previous)
      )
        return false;
      previous = id;
    }
    if (candidate.hasMore) {
      return (
        ids.length > 0 &&
        candidate.nextCursor === ids[ids.length - 1] &&
        candidate.nextCursor !== cursor
      );
    }
    return candidate.nextCursor === null;
  }
}
