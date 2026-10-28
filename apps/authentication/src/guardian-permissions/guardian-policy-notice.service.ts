import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EmailService } from '@optimistic-tanuki/email';
import { timingSafeEqual } from 'crypto';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { UserEntity } from '../user/entities/user.entity';
import { GuardianPermissionEntity } from './entities/guardian-permission.entity';
import { GuardianPolicyNoticeEntity } from './entities/guardian-policy-notice.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_RETENTION_MS = 90 * DAY_MS;
const LEASE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BATCH_LIMIT = 25;

type ApprovedPolicy = { url: string };

@Injectable()
export class GuardianPolicyNoticeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuardianPolicyNoticeService.name);
  private deliveryTimer?: ReturnType<typeof setInterval>;
  private stopping = false;
  private readonly activeDeliveries = new Set<Promise<number>>();

  constructor(
    @Inject(getRepositoryToken(GuardianPermissionEntity))
    private readonly permissions: Repository<GuardianPermissionEntity>,
    @Inject(getRepositoryToken(UserEntity))
    private readonly users: Repository<UserEntity>,
    @Inject(getRepositoryToken(GuardianPolicyNoticeEntity))
    private readonly notices: Repository<GuardianPolicyNoticeEntity>,
    private readonly email: EmailService
  ) {}

  onModuleInit(): void {
    this.deliveryTimer = setInterval(
      () => void this.runDeliverySafely(),
      30_000
    );
    this.deliveryTimer.unref?.();
    void this.runDeliverySafely();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.deliveryTimer) clearInterval(this.deliveryTimer);
    await Promise.allSettled([...this.activeDeliveries]);
  }

  async schedulePolicyNotice(
    policyVersion: string,
    operatorToken?: string
  ): Promise<{
    policyVersion: string;
    scheduled: number;
    alreadyScheduled: number;
  }> {
    this.assertAuthorizedOperator(operatorToken);
    const policy = this.getApprovedPolicy(policyVersion);
    const links = await this.permissions.find({
      where: { status: 'approved' },
    });
    const guardians = new Map<string, GuardianPermissionEntity>();

    for (const link of links) {
      if (
        !link.guardianUserId ||
        !link.dateOfBirth ||
        this.ageFromDate(link.dateOfBirth) >= 18
      ) {
        continue;
      }
      guardians.set(link.guardianUserId, link);
    }

    let scheduled = 0;
    let alreadyScheduled = 0;
    for (const [guardianUserId, link] of guardians) {
      const guardian = await this.users.findOne({
        where: { id: guardianUserId },
      });
      if (
        !guardian ||
        !guardian.emailVerifiedAt ||
        guardian.ageEligibilityStatus !== 'adult' ||
        !guardian.email?.trim()
      ) {
        continue;
      }
      const existing = await this.notices.findOne({
        where: { policyVersion, guardianUserId },
      });
      if (existing) {
        alreadyScheduled++;
        continue;
      }
      try {
        await this.notices.save(
          this.notices.create({
            policyVersion,
            policyUrl: policy.url,
            guardianUserId,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
            leaseUntil: null,
            lastFailureCode: null,
            acceptedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        );
        scheduled++;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          alreadyScheduled++;
          continue;
        }
        throw error;
      }
    }
    return { policyVersion, scheduled, alreadyScheduled };
  }

  async retryFailedNotices(
    policyVersion: string,
    operatorToken?: string
  ): Promise<{
    policyVersion: string;
    retried: number;
  }> {
    this.assertAuthorizedOperator(operatorToken);
    this.getApprovedPolicy(policyVersion);
    const result = await this.notices.update(
      { policyVersion, status: 'failed' },
      {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
        leaseUntil: null,
        lastFailureCode: null,
        updatedAt: new Date(),
      }
    );
    return { policyVersion, retried: result.affected ?? 0 };
  }

  async getNoticeStatus(
    policyVersion: string,
    operatorToken?: string
  ): Promise<{
    policyVersion: string;
    pending: number;
    sending: number;
    accepted: number;
    failed: number;
    suppressed: number;
  }> {
    this.assertAuthorizedOperator(operatorToken);
    this.getApprovedPolicy(policyVersion);
    const statuses = [
      'pending',
      'sending',
      'accepted',
      'failed',
      'suppressed',
    ] as const;
    const counts = await Promise.all(
      statuses.map((status) =>
        this.notices.count({ where: { policyVersion, status } })
      )
    );
    return {
      policyVersion,
      pending: counts[0],
      sending: counts[1],
      accepted: counts[2],
      failed: counts[3],
      suppressed: counts[4],
    };
  }

  async deliverDueNotices(now = new Date()): Promise<number> {
    if (this.stopping) return 0;
    const work = this.processDueNotices(now);
    this.activeDeliveries.add(work);
    try {
      return await work;
    } finally {
      this.activeDeliveries.delete(work);
    }
  }

  private async processDueNotices(now: Date): Promise<number> {
    const due = await this.notices.find({
      where: [
        { status: 'pending', nextAttemptAt: LessThanOrEqual(now) },
        { status: 'sending', leaseUntil: LessThanOrEqual(now) },
      ],
      order: { createdAt: 'ASC' },
      take: BATCH_LIMIT,
    });

    let processed = 0;
    for (const candidate of due) {
      const delivered = await this.notices.manager.transaction(
        async (manager) => {
          const repo = manager.getRepository(GuardianPolicyNoticeEntity);
          const current = await repo.findOne({
            where: { id: candidate.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!current) return false;
          const isDue =
            current.status === 'pending'
              ? current.nextAttemptAt <= now
              : current.status === 'sending' &&
                current.leaseUntil != null &&
                current.leaseUntil <= now;
          if (!isDue) return false;
          await repo.update(current.id, {
            status: 'sending',
            leaseUntil: new Date(now.getTime() + LEASE_MS),
            updatedAt: now,
          });
          // Keep the row locked through the bounded provider call. Cancellation
          // acknowledges only after an already-started send finishes; it cannot unsend it.
          await this.deliverOne(current, now, repo);
          return true;
        }
      );
      if (delivered) processed++;
    }
    return processed;
  }

  /** Internal local-work primitive, not a public account-deletion endpoint. */
  async suppressPendingForGuardian(
    guardianUserId: string,
    appId: string
  ): Promise<number> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        guardianUserId
      ) ||
      !['client-interface', 'local-hub'].includes(appId)
    )
      throw new Error('NOTICE_CANCEL_INVALID_SCOPE');
    const links = await this.permissions.find({ where: { guardianUserId } });
    if (
      !links.some((link) => link.appId === appId) ||
      links.some(
        (link) => !['client-interface', 'local-hub'].includes(link.appId)
      )
    )
      throw new Error('NOTICE_CANCEL_SCOPE_UNPROVEN');
    const result = await this.notices.update(
      { guardianUserId, status: In(['pending', 'sending']) },
      {
        status: 'suppressed',
        leaseUntil: null,
        lastFailureCode: null,
        updatedAt: new Date(),
      }
    );
    return result.affected ?? 0;
  }

  async cleanupExpiredNotices(now = new Date()): Promise<number> {
    const result = await this.notices.delete({
      createdAt: LessThanOrEqual(new Date(now.getTime() - NOTICE_RETENTION_MS)),
    });
    return result.affected ?? 0;
  }

  private async deliverOne(
    notice: GuardianPolicyNoticeEntity,
    now: Date,
    notices: Repository<GuardianPolicyNoticeEntity> = this.notices
  ): Promise<void> {
    const [guardian, links] = await Promise.all([
      this.users.findOne({ where: { id: notice.guardianUserId } }),
      this.permissions.find({
        where: { guardianUserId: notice.guardianUserId, status: 'approved' },
      }),
    ]);
    const activeLink = links.find(
      (link) =>
        link.dateOfBirth &&
        this.ageFromDate(link.dateOfBirth) < 18 &&
        link.emailFrom
    );
    if (
      !guardian ||
      !guardian.emailVerifiedAt ||
      guardian.ageEligibilityStatus !== 'adult' ||
      !guardian.email?.trim() ||
      !activeLink
    ) {
      await notices.update(notice.id, {
        status: 'suppressed',
        leaseUntil: null,
        lastFailureCode: null,
        updatedAt: now,
      });
      return;
    }

    const testNotice = notice.policyVersion.startsWith('TEST-');
    const subject = testNotice
      ? `[TEST] Guardian policy notice ${notice.policyVersion}`
      : 'An update to the guardian permission policy';
    const body = testNotice
      ? `TEST NOTICE — no public policy change was made. This Mailpit test verifies guardian policy notice delivery for ${notice.policyVersion}. Read the test policy at ${notice.policyUrl}. No new attestation is required.`
      : `Our guardian permission policy has changed. Read the current policy at ${notice.policyUrl}. This is a notification only; no new attestation is required.`;

    try {
      const result = await this.email.sendEmail({
        to: guardian.email,
        from: activeLink.emailFrom,
        subject,
        text: body,
        html: `<p>${this.escapeHtml(body)}</p><p><a href="${this.escapeHtml(
          notice.policyUrl
        )}">Read the policy</a></p>`,
        sensitive: true,
      });
      if (result.success) {
        await notices.update(notice.id, {
          status: 'accepted',
          leaseUntil: null,
          lastFailureCode: null,
          acceptedAt: now,
          updatedAt: now,
        });
        return;
      }
      await this.recordDeliveryFailure(notice, now, notices);
    } catch {
      await this.recordDeliveryFailure(notice, now, notices);
    }
  }

  private async recordDeliveryFailure(
    notice: GuardianPolicyNoticeEntity,
    now: Date,
    notices: Repository<GuardianPolicyNoticeEntity> = this.notices
  ): Promise<void> {
    const attempts = notice.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(5 * 60_000 * 2 ** (attempts - 1), DAY_MS);
    await notices.update(notice.id, {
      status: failed ? 'failed' : 'pending',
      attempts,
      nextAttemptAt: new Date(now.getTime() + delayMs),
      leaseUntil: null,
      lastFailureCode: failed ? 'EMAIL_PROVIDER_REJECTED' : null,
      updatedAt: now,
    });
  }

  private async runDeliverySafely(): Promise<void> {
    try {
      await this.deliverDueNotices();
    } catch {
      this.logger.error('Guardian policy notice delivery pass failed');
    }
  }

  private getApprovedPolicy(policyVersion: string): ApprovedPolicy {
    const raw = process.env.GUARDIAN_POLICY_NOTICE_APPROVED_POLICIES;
    let approved: Record<string, ApprovedPolicy>;
    try {
      approved = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error('Guardian policy notice configuration is invalid');
    }
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(policyVersion || '') ||
      !approved[policyVersion] ||
      typeof approved[policyVersion].url !== 'string'
    ) {
      throw new Error('Guardian policy version is not approved for delivery');
    }
    let url: URL;
    try {
      url = new URL(approved[policyVersion].url);
    } catch {
      throw new Error('Approved guardian policy URL is invalid');
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new Error('Approved guardian policy URL is invalid');
    }
    return { url: url.toString() };
  }

  private assertAuthorizedOperator(operatorToken?: string): void {
    const configured = process.env.GUARDIAN_POLICY_NOTICE_OPERATOR_TOKEN;
    if (!configured || !operatorToken) {
      throw new Error('Guardian policy notice operator authorization failed');
    }
    const expected = Buffer.from(configured);
    const provided = Buffer.from(operatorToken);
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new Error('Guardian policy notice operator authorization failed');
    }
  }

  private ageFromDate(dateOfBirth: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return 18;
    const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    if (
      now.getUTCMonth() < dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() &&
        now.getUTCDate() < dob.getUTCDate())
    ) {
      age--;
    }
    return age;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[character] as string)
    );
  }
}
