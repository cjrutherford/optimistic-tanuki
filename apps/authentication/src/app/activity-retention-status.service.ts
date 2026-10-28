import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ActivityRetentionReport,
  ActivityRetentionService,
} from '@optimistic-tanuki/logger';
import type { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
const DECLARED = {
  profile: ['guardian_profile_activity'],
  assets: ['guardian_asset_activity'],
  social: [
    'activity',
    'profile_view',
    'search_history',
    'community_membership_audit',
    'content_moderation_action',
    'guardian_content_audit',
  ],
  forum: ['forum_moderation_action'],
} as const;
/** Internal operational status, not public account status or erasure authority. */
@Injectable()
export class ActivityRetentionStatusService {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profile: ClientProxy,
    @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assets: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE) private readonly social: ClientProxy,
    @Inject(ServiceTokens.FORUM_SERVICE) private readonly forum: ClientProxy,
    private readonly local: ActivityRetentionService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly database: DataSource
  ) {}
  async readback() {
    const reports: Array<{
      owner: string;
      state: string;
      cutoff: string | null;
      sources: Array<{
        source: string;
        deleted: number;
        remaining: number | null;
        state: string;
      }>;
    }> = await Promise.all(
      (Object.keys(DECLARED) as (keyof typeof DECLARED)[]).map(
        async (owner) => {
          try {
            const report = await firstValueFrom(
              this[owner]
                .send<ActivityRetentionReport>(
                  { cmd: 'account-activity-retention.status' },
                  {}
                )
                .pipe(timeout(35000))
            );
            const names = DECLARED[owner] as readonly string[];
            if (
              !report ||
              report.owner !== owner ||
              typeof report.cutoff !== 'string' ||
              report.cutoff.length > 64 ||
              !Number.isFinite(Date.parse(report.cutoff)) ||
              !Array.isArray(report.sources) ||
              report.sources.length !== names.length ||
              new Set(report.sources.map((v) => v.source)).size !== names.length
            )
              throw Error('RETENTION_STATUS_INVALID');
            const sources = report.sources.map((source) => {
              if (
                !names.includes(source.source) ||
                source.deleted !== 0 ||
                (source.remaining !== null &&
                  (!Number.isSafeInteger(source.remaining) ||
                    source.remaining < 0))
              )
                throw Error('RETENTION_STATUS_INVALID');
              const state =
                source.remaining === null
                  ? 'blocked'
                  : source.remaining > 0
                  ? 'pending'
                  : 'verified';
              if (source.state !== state)
                throw Error('RETENTION_STATUS_INVALID');
              return {
                source: source.source,
                deleted: 0,
                remaining: source.remaining,
                state,
              };
            });
            const state = sources.some((v) => v.state === 'blocked')
              ? 'blocked'
              : sources.some((v) => v.state === 'pending')
              ? 'pending'
              : 'verified';
            if (report.state !== state) throw Error('RETENTION_STATUS_INVALID');
            return { owner, state, cutoff: report.cutoff, sources };
          } catch {
            return {
              owner,
              state: 'blocked' as const,
              cutoff: null,
              sources: [],
            };
          }
        }
      )
    );
    try {
      const local = await this.local.readback();
      if (
        local.owner !== 'authentication' ||
        local.sources.length !== 1 ||
        local.sources[0].source !== 'guardian_policy_notice'
      )
        throw Error('RETENTION_STATUS_INVALID');
      reports.push(local);
    } catch {
      reports.push({
        owner: 'authentication',
        state: 'blocked',
        cutoff: null,
        sources: [],
      });
    }
    let remaining: number | null = null;
    try {
      const rows = await this.database.query(
        `SELECT count(*)::text AS remaining FROM "account_export_jobs" WHERE "kind"='export' AND "appId" IN ('client-interface','local-hub') AND "state" IN ('complete','failed','incomplete') AND COALESCE("completedAt","updatedAt","createdAt")<=clock_timestamp()-interval '90 days'`
      );
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        !/^\d+$/.test(String(rows[0]?.remaining)) ||
        !Number.isSafeInteger(Number(rows[0].remaining))
      )
        throw Error('RETENTION_STATUS_INVALID');
      remaining = Number(rows[0].remaining);
    } catch {
      /* Unknown job custody/history remains blocked. */
    }
    const jobHistory = {
      source: 'account_export_jobs',
      remaining,
      state:
        remaining === null ? 'blocked' : remaining > 0 ? 'pending' : 'verified',
    };
    return {
      state:
        reports.some((v) => v.state === 'blocked') || remaining === null
          ? 'blocked'
          : reports.some((v) => v.state === 'pending') || remaining > 0
          ? 'pending'
          : 'verified',
      owners: reports,
      jobHistory,
    };
  }
}
