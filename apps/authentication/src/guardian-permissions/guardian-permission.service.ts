import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { EmailService, renderDomainEmailTemplate } from '@optimistic-tanuki/email';
import { createHash, randomBytes } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { GuardianPermissionEntity } from './entities/guardian-permission.entity';

export interface GuardianPermissionContext {
  appId: string;
  appName: string;
  uiBaseUrl: string;
  from: string;
  replyTo?: string;
}

const PENDING_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ACTIVE_DELETE_DELAY_MS = 90 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const ATTESTATION_VERSION = 'guardian-attestation-v1';
const ATTESTATION_TEXT =
  'I am the parent or legal guardian of this user and give permission for them to use Optimistic Tanuki and Towne Square while they are under 18.';

@Injectable()
export class GuardianPermissionService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(getRepositoryToken(GuardianPermissionEntity))
    private readonly permissions: Repository<GuardianPermissionEntity>,
    @Inject(getRepositoryToken(UserEntity))
    private readonly users: Repository<UserEntity>,
    @Inject(getRepositoryToken(TokenEntity))
    private readonly sessions: Repository<TokenEntity>,
    private readonly email: EmailService
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => void this.cleanupExpired(), 24 * 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
    void this.cleanupExpired();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async requestPermission(input: {
    dateOfBirth: string;
    applicantEmail: string;
    guardianEmail: string;
    userId?: string;
    context: GuardianPermissionContext;
  }): Promise<{ pending: true; sent: boolean }> {
    await this.cleanupExpired();
    const age = this.ageFromDate(input.dateOfBirth);
    if (age < 13) throw new RpcException({ code: 'AGE_UNDER_13' });
    if (age >= 18) {
      if (input.userId) {
        await this.users.update(input.userId, {
          ageEligibilityStatus: 'adult',
          ageEligibilityEndsAt: null,
        });
      }
      return { pending: true, sent: false };
    }
    if (!input.applicantEmail?.trim() || !input.guardianEmail?.trim()) {
      throw new RpcException('Applicant and guardian email are required');
    }

    const applicantEmail = input.applicantEmail.trim().toLowerCase();
    const guardianEmail = input.guardianEmail.trim().toLowerCase();
    const existing = await this.permissions.findOne({
      where: [
        { applicantEmail, status: 'pending' },
        ...(input.userId ? [{ userId: input.userId, status: 'pending' as const }] : []),
      ],
      order: { createdAt: 'DESC' },
    });
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      return { pending: true, sent: true };
    }

    // Failed mail attempts for an account keep a unique userId association
    // until privacy cleanup. Reuse that row atomically, preserving its first
    // request deadline while it is still live, rather than inserting a second
    // association that violates the unique index.
    let priorForUser: GuardianPermissionEntity | null = null;
    if (input.userId) {
      priorForUser = await this.permissions.findOne({
        where: { userId: input.userId },
      });
    }
    if (priorForUser && priorForUser.status !== 'expired') {
      throw new RpcException({ code: 'AGE_ASSESSMENT_MISMATCH' });
    }

    const guardianToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(guardianToken);
    const now = new Date();
    const requestCreatedAt = priorForUser?.status === 'expired' && priorForUser.expiresAt > now
      ? priorForUser.createdAt
      : now;
    const requestExpiresAt = priorForUser?.status === 'expired' && priorForUser.expiresAt > now
      ? priorForUser.expiresAt
      : new Date(requestCreatedAt.getTime() + PENDING_TTL_MS);
    const permissionData: Omit<GuardianPermissionEntity, 'id'> = {
      applicantEmail,
      guardianEmail,
      dateOfBirth: input.dateOfBirth,
      userId: input.userId || null,
      guardianUserId: null,
      status: 'pending',
      guardianTokenHash: tokenHash,
      resumeTokenHash: null,
      withdrawalTokenHash: null,
      attestationVersion: null,
      attestationText: null,
      createdAt: requestCreatedAt,
      expiresAt: requestExpiresAt,
      attestedAt: null,
      deleteAfter: null,
      resumeExpiresAt: null,
      appId: input.context.appId,
      appName: input.context.appName,
      uiBaseUrl: input.context.uiBaseUrl,
      emailFrom: input.context.from,
      replyTo: input.context.replyTo || null,
    };
    let permission: GuardianPermissionEntity;
    if (priorForUser?.status === 'expired') {
      const reset = await this.permissions.update(
        { id: priorForUser.id, userId: input.userId, status: 'expired' },
        permissionData
      );
      if (!reset.affected) {
        // A concurrent request already moved this account out of the expired
        // state. Do not duplicate the association or start a second email.
        return { pending: true, sent: false };
      }
      permission = { ...priorForUser, ...permissionData };
    } else {
      permission = await this.permissions.save(permissionData);
    }
    if (input.userId) {
      await this.users.update(input.userId, {
        ageEligibilityEndsAt: this.eighteenthBirthday(input.dateOfBirth)
          .toISOString()
          .slice(0, 10),
      });
    }
    const link = `${input.context.uiBaseUrl.replace(/\/$/, '')}/auth/guardian-consent#token=${encodeURIComponent(guardianToken)}`;
    const template = renderDomainEmailTemplate({
      domain: input.context.uiBaseUrl,
      appName: input.context.appName,
      heading: 'Parent or guardian permission requested',
      body: [
        'A user under 18 has asked to use Optimistic Tanuki and Towne Square with your permission.',
        'If you are their parent or legal guardian, use the private link to review and attest. This records your statement; it does not independently verify identity or guardianship.',
      ],
      action: { label: 'Review permission request', url: link },
      note: 'If you are not the parent or legal guardian, ignore this email.',
      tone: 'security',
    });
    let emailSent = false;
    try {
      const sent = await this.email.sendEmail({
        to: guardianEmail,
        from: input.context.from,
        replyTo: input.context.replyTo,
        subject: `Permission request — ${input.context.appName}`,
        text: template.text,
        html: template.html,
      });
      emailSent = sent.success;
    } catch {
      emailSent = false;
    }
    if (!emailSent) {
      await this.permissions.update(permission.id, {
        status: 'expired',
        guardianTokenHash: null,
        deleteAfter: new Date(Math.min(
          Date.now() + ACTIVE_DELETE_DELAY_MS,
          permission.createdAt.getTime() + PENDING_TTL_MS
        )),
      });
    } else if (input.userId) {
      // Only mark the account pending after the guardian request was actually
      // accepted by the shared mail service. A delivery failure leaves the
      // account eligible to retry the assessment on its next login.
      await this.users.update(input.userId, { ageEligibilityStatus: 'minor-pending' });
    }
    return { pending: true, sent: emailSent };
  }

  async attestAsGuardian(
    rawToken: string,
    guardianUserId: string,
    input: { attested: true; attestationVersion: string; dateOfBirth?: string }
  ): Promise<{
    attested: true;
    applicantNotified: boolean;
    continuationRequired: boolean;
    withdrawalUrl: string;
  }> {
    if (!rawToken) throw new RpcException({ code: 'GUARDIAN_TOKEN_INVALID' });
    const permission = await this.permissions.findOne({
      where: {
        guardianTokenHash: this.hash(rawToken),
        status: 'pending',
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!permission) throw new RpcException({ code: 'GUARDIAN_TOKEN_INVALID' });
    const guardian = await this.users.findOne({ where: { id: guardianUserId } });
    if (
      !guardian ||
      guardian.email.trim().toLowerCase() !== permission.guardianEmail?.toLowerCase() ||
      guardian.email.trim().toLowerCase() === permission.applicantEmail.toLowerCase() ||
      guardian.id === permission.userId ||
      input?.attested !== true ||
      input.attestationVersion !== ATTESTATION_VERSION
    ) {
      throw new RpcException({ code: 'GUARDIAN_ATTESTATION_REQUIRED' });
    }
    const guardianStatus = guardian.ageEligibilityStatus || 'legacy';
    if (guardianStatus !== 'adult') {
      if (!['legacy', 'unassessed'].includes(guardianStatus) || !input.dateOfBirth) {
        throw new RpcException({ code: 'GUARDIAN_ADULT_REQUIRED' });
      }
      if (this.ageFromDate(input.dateOfBirth) < 18) {
        throw new RpcException({ code: 'GUARDIAN_ADULT_REQUIRED' });
      }
      const assessed = await this.users.update(
        {
          id: guardian.id,
          ageEligibilityStatus: In(['legacy', 'unassessed']),
        },
        { ageEligibilityStatus: 'adult', ageEligibilityEndsAt: null }
      );
      if (!assessed.affected) {
        throw new RpcException({ code: 'GUARDIAN_ADULT_REQUIRED' });
      }
    }

    const resumeToken = randomBytes(32).toString('base64url');
    const withdrawalToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const unattachedDeadline = new Date(Math.min(
      now.getTime() + TOKEN_TTL_MS,
      permission.createdAt.getTime() + PENDING_TTL_MS
    ));
    const updated = await this.permissions.update(
      {
        id: permission.id,
        status: 'pending',
        guardianTokenHash: this.hash(rawToken),
        expiresAt: MoreThan(now),
      },
      {
        status: 'approved',
        guardianTokenHash: null,
        guardianUserId,
        resumeTokenHash: permission.userId ? null : this.hash(resumeToken),
        resumeExpiresAt: permission.userId ? null : unattachedDeadline,
        withdrawalTokenHash: this.hash(withdrawalToken),
        attestationVersion: ATTESTATION_VERSION,
        attestationText: ATTESTATION_TEXT,
        attestedAt: now,
        deleteAfter: permission.userId ? null : unattachedDeadline,
      }
    );
    if (!updated.affected) throw new RpcException({ code: 'GUARDIAN_TOKEN_USED' });

    if (permission.userId) {
      await this.users.update(permission.userId, { ageEligibilityStatus: 'minor' });
      await this.sendWithdrawalLink(permission, withdrawalToken);
      return {
        attested: true,
        applicantNotified: false,
        continuationRequired: false,
        withdrawalUrl: this.withdrawalUrl(permission, withdrawalToken),
      };
    }

    const context = this.contextFor(permission);
    const resumeUrl = `${context.uiBaseUrl.replace(/\/$/, '')}/register#token=${encodeURIComponent(resumeToken)}`;
    const template = renderDomainEmailTemplate({
      domain: context.uiBaseUrl,
      appName: context.appName,
      heading: 'Permission recorded',
      body: ['Your parent or guardian has recorded permission. Continue registration using your private link.'],
      action: { label: 'Continue registration', url: resumeUrl },
      note: `This private link can be used once and expires on ${unattachedDeadline.toISOString()}.`,
      tone: 'security',
    });
    let applicantNotified = false;
    try {
      const result = await this.email.sendEmail({
        to: permission.applicantEmail,
        from: context.from,
        replyTo: context.replyTo,
        subject: `Continue registration — ${context.appName}`,
        text: template.text,
        html: template.html,
      });
      applicantNotified = result.success;
    } catch {
      // Approval is already committed; the guardian response below still
      // carries the independent withdrawal control if email is unavailable.
    }
    await this.sendWithdrawalLink(permission, withdrawalToken);
    return {
      attested: true,
      applicantNotified,
      continuationRequired: true,
      withdrawalUrl: this.withdrawalUrl(permission, withdrawalToken),
    };
  }

  async validateResume(rawToken: string): Promise<{ valid: true; email: string }> {
    const permission = await this.findResume(rawToken);
    return { valid: true, email: permission.applicantEmail };
  }

  async attachAccount(rawToken: string, userId: string): Promise<{ attached: true }> {
    const permission = await this.findResume(rawToken);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.email.trim().toLowerCase() !== permission.applicantEmail.toLowerCase()) {
      throw new RpcException({ code: 'GUARDIAN_RESUME_IDENTITY_MISMATCH' });
    }
    const updated = await this.permissions.update(
      {
        id: permission.id,
        status: 'approved',
        resumeTokenHash: this.hash(rawToken),
        userId: IsNull(),
      },
      { userId, resumeTokenHash: null, deleteAfter: null }
    );
    if (!updated.affected) throw new RpcException({ code: 'GUARDIAN_RESUME_USED' });
    await this.users.update(userId, {
      ageEligibilityStatus: 'minor',
      ageEligibilityEndsAt: this.eighteenthBirthday(permission.dateOfBirth!)
        .toISOString()
        .slice(0, 10),
    });
    return { attached: true };
  }

  async assertAccountAccess(userId: string, appId?: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new RpcException('User not found');
    let status = user.ageEligibilityStatus || 'legacy';
    if (
      ['minor-pending', 'minor', 'revoked'].includes(status) &&
      user.ageEligibilityEndsAt &&
      new Date(`${user.ageEligibilityEndsAt}T00:00:00.000Z`).getTime() <= Date.now()
    ) {
      await this.users.update(userId, {
        ageEligibilityStatus: 'adult',
        ageEligibilityEndsAt: null,
      });
      status = 'adult';
    }
    // Pending or withdrawn minor accounts are inactive globally. Check these
    // before the app-specific exemption so an untrusted app label cannot
    // revive a blocked account elsewhere on the platform.
    if (status === 'minor-pending' || status === 'revoked') {
      throw new RpcException({ code: 'GUARDIAN_PERMISSION_REQUIRED' });
    }
    if (appId && !this.isAgeGatedApp(appId)) return;
    if (status === 'legacy' || status === 'adult') return;
    const permission = await this.permissions.findOne({ where: { userId } });
    if (
      status === 'minor' &&
      permission?.status === 'approved' &&
      permission.dateOfBirth
    ) {
      if (this.ageFromDate(permission.dateOfBirth) < 18) return;
      await this.permissions.update(permission.id, {
        deleteAfter: this.retentionDateAfterEighteenthBirthday(permission.dateOfBirth),
      });
      await this.users.update(userId, { ageEligibilityStatus: 'adult' });
      return;
    }
    throw new RpcException({ code: status === 'unassessed' ? 'AGE_CHECK_REQUIRED' : 'GUARDIAN_PERMISSION_REQUIRED' });
  }

  async assertDelegatedProfileAccess(input: {
    actorUserId: string;
    dependentUserId: string;
    appId: string;
    operation: string;
  }): Promise<void> {
    const allowedApps = new Set(['client-interface', 'local-hub']);
    const allowedOperations = new Set(['profile.view', 'profile.manage']);
    if (
      !input?.actorUserId ||
      !input.dependentUserId ||
      input.actorUserId === input.dependentUserId ||
      !allowedApps.has(input.appId) ||
      !allowedOperations.has(input.operation)
    ) {
      throw new RpcException({ code: 'GUARDIAN_PROFILE_ACCESS_DENIED' });
    }

    const session = await this.sessions.findOne({
      where: { userId: input.actorUserId, revoked: false },
    });
    const actor = await this.users.findOne({ where: { id: input.actorUserId } });
    if (
      !session ||
      !actor ||
      actor.ageEligibilityStatus !== 'adult' ||
      (actor.lockedUntil && new Date(actor.lockedUntil).getTime() > Date.now())
    ) {
      throw new RpcException({ code: 'GUARDIAN_PROFILE_ACCESS_DENIED' });
    }

    const dependent = await this.users.findOne({
      where: { id: input.dependentUserId },
    });
    if (
      !dependent ||
      dependent.ageEligibilityStatus !== 'minor' ||
      !dependent.ageEligibilityEndsAt ||
      new Date(`${dependent.ageEligibilityEndsAt}T00:00:00.000Z`).getTime() <= Date.now()
    ) {
      throw new RpcException({ code: 'GUARDIAN_PROFILE_ACCESS_DENIED' });
    }

    const permission = await this.permissions.findOne({
      where: {
        userId: input.dependentUserId,
        guardianUserId: input.actorUserId,
        status: 'approved',
      },
    });
    if (
      !permission?.dateOfBirth ||
      this.ageFromDate(permission.dateOfBirth) >= 18
    ) {
      throw new RpcException({ code: 'GUARDIAN_PROFILE_ACCESS_DENIED' });
    }
  }

  async assessUnassessedLogin(input: {
    userId: string;
    email: string;
    status: UserEntity['ageEligibilityStatus'];
    ageEligibilityEndsAt?: string | null;
    dateOfBirth?: string;
    guardianEmail?: string;
    context: GuardianPermissionContext;
  }): Promise<{ pending: boolean; sent: boolean }> {
    if (
      !this.isAgeGatedApp(input.context.appId) ||
      !['unassessed', 'minor-pending'].includes(input.status || 'unassessed')
    ) {
      return { pending: false, sent: false };
    }
    if (!input.dateOfBirth) throw new RpcException({ code: 'AGE_CHECK_REQUIRED' });
    if (input.ageEligibilityEndsAt) {
      const submittedEnd = this.eighteenthBirthday(input.dateOfBirth);
      const expectedEnd = new Date(`${input.ageEligibilityEndsAt}T00:00:00.000Z`);
      if (submittedEnd.getTime() !== expectedEnd.getTime()) {
        throw new RpcException({ code: 'AGE_ASSESSMENT_MISMATCH' });
      }
      if (expectedEnd.getTime() <= Date.now()) {
        await this.users.update(input.userId, {
          ageEligibilityStatus: 'adult',
          ageEligibilityEndsAt: null,
        });
        return { pending: false, sent: false };
      }
    }
    const age = this.ageFromDate(input.dateOfBirth);
    if (age < 13) throw new RpcException({ code: 'AGE_UNDER_13' });
    if (age >= 18) {
      if (input.status === 'minor-pending' || input.ageEligibilityEndsAt) {
        throw new RpcException({ code: 'AGE_ASSESSMENT_MISMATCH' });
      }
      await this.users.update(input.userId, {
        ageEligibilityStatus: 'adult',
        ageEligibilityEndsAt: null,
      });
      return { pending: false, sent: false };
    }
    if (!input.guardianEmail?.trim()) {
      throw new RpcException({ code: 'GUARDIAN_EMAIL_REQUIRED' });
    }
    const request = await this.requestPermission({
      userId: input.userId,
      applicantEmail: input.email,
      guardianEmail: input.guardianEmail,
      dateOfBirth: input.dateOfBirth,
      context: input.context,
    });
    return { pending: true, sent: request.sent };
  }

  async withdraw(userId: string): Promise<{ revoked: true }> {
    const permission = await this.permissions.findOne({ where: { userId, status: 'approved' } });
    if (!permission) throw new RpcException({ code: 'GUARDIAN_PERMISSION_NOT_FOUND' });
    const now = new Date();
    await this.permissions.update(permission.id, {
      status: 'revoked',
      deleteAfter: new Date(now.getTime() + ACTIVE_DELETE_DELAY_MS),
      guardianTokenHash: null,
      resumeTokenHash: null,
      withdrawalTokenHash: null,
    });
    await this.users.update(userId, { ageEligibilityStatus: 'revoked' });
    await this.sessions.update({ userId, revoked: false }, { revoked: true });
    return { revoked: true };
  }

  async withdrawByToken(rawToken: string): Promise<{ revoked: true; noLongerNeeded?: true }> {
    if (!rawToken) throw new RpcException({ code: 'GUARDIAN_WITHDRAWAL_INVALID' });
    const permission = await this.permissions.findOne({
      where: { withdrawalTokenHash: this.hash(rawToken), status: 'approved' },
    });
    if (!permission) throw new RpcException({ code: 'GUARDIAN_WITHDRAWAL_INVALID' });
    if (permission.dateOfBirth && this.ageFromDate(permission.dateOfBirth) >= 18) {
      await this.permissions.update(
        { id: permission.id, withdrawalTokenHash: this.hash(rawToken), status: 'approved' },
        {
          status: 'expired',
          deleteAfter: this.retentionDateAfterEighteenthBirthday(permission.dateOfBirth),
          guardianTokenHash: null,
          resumeTokenHash: null,
          withdrawalTokenHash: null,
        }
      );
      if (permission.userId) {
        await this.users.update(permission.userId, {
          ageEligibilityStatus: 'adult',
          ageEligibilityEndsAt: null,
        });
      }
      return { revoked: true, noLongerNeeded: true };
    }
    const now = new Date();
    const updated = await this.permissions.update(
      { id: permission.id, withdrawalTokenHash: this.hash(rawToken), status: 'approved' },
      {
        status: 'revoked',
        deleteAfter: new Date(now.getTime() + ACTIVE_DELETE_DELAY_MS),
        guardianTokenHash: null,
        resumeTokenHash: null,
        withdrawalTokenHash: null,
      }
    );
    if (!updated.affected) throw new RpcException({ code: 'GUARDIAN_WITHDRAWAL_USED' });
    if (permission.userId) {
      await this.users.update(permission.userId, { ageEligibilityStatus: 'revoked' });
      await this.sessions.update({ userId: permission.userId, revoked: false }, { revoked: true });
    }
    return { revoked: true };
  }

  async resendApplicantContinuation(rawToken: string): Promise<{ sent: boolean }> {
    if (!rawToken) throw new RpcException({ code: 'GUARDIAN_WITHDRAWAL_INVALID' });
    const now = new Date();
    const permission = await this.permissions.findOne({
      where: {
        withdrawalTokenHash: this.hash(rawToken),
        status: 'approved',
        userId: IsNull(),
        resumeExpiresAt: MoreThan(now),
      },
    });
    if (
      !permission ||
      !permission.dateOfBirth ||
      this.ageFromDate(permission.dateOfBirth) >= 18 ||
      !permission.resumeExpiresAt ||
      permission.resumeExpiresAt.getTime() > permission.createdAt.getTime() + PENDING_TTL_MS
    ) {
      throw new RpcException({ code: 'GUARDIAN_RESEND_UNAVAILABLE' });
    }

    const resumeToken = randomBytes(32).toString('base64url');
    const rotated = await this.permissions.update(
      {
        id: permission.id,
        status: 'approved',
        userId: IsNull(),
        withdrawalTokenHash: this.hash(rawToken),
        resumeExpiresAt: MoreThan(now),
      },
      { resumeTokenHash: this.hash(resumeToken) }
    );
    if (!rotated.affected) throw new RpcException({ code: 'GUARDIAN_RESEND_UNAVAILABLE' });

    const context = this.contextFor(permission);
    const resumeUrl = `${context.uiBaseUrl.replace(/\/$/, '')}/register#token=${encodeURIComponent(resumeToken)}`;
    const template = renderDomainEmailTemplate({
      domain: context.uiBaseUrl,
      appName: context.appName,
      heading: 'Continue registration',
      body: ['Your parent or guardian has recorded permission. Continue registration using your private link.'],
      action: { label: 'Continue registration', url: resumeUrl },
      note: `This private link can be used once and expires on ${permission.resumeExpiresAt?.toISOString() || 'its original deadline'}.`,
      tone: 'security',
    });
    try {
      const result = await this.email.sendEmail({
        to: permission.applicantEmail,
        from: context.from,
        replyTo: context.replyTo,
        subject: `Continue registration — ${context.appName}`,
        text: template.text,
        html: template.html,
      });
      return { sent: result.success };
    } catch {
      return { sent: false };
    }
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    await this.permissions.delete({ status: 'pending', expiresAt: LessThan(now) });
    await this.users.update(
      {
        ageEligibilityStatus: In(['minor-pending', 'minor', 'revoked']),
        ageEligibilityEndsAt: LessThanOrEqual(now.toISOString().slice(0, 10)),
      },
      { ageEligibilityStatus: 'adult', ageEligibilityEndsAt: null }
    );
    const active = await this.permissions.find({
      where: { status: 'approved', dateOfBirth: Not(IsNull()), deleteAfter: IsNull() },
    });
    for (const permission of active) {
      if (permission.dateOfBirth && this.ageFromDate(permission.dateOfBirth) >= 18) {
        await this.permissions.update(permission.id, {
          deleteAfter: this.retentionDateAfterEighteenthBirthday(permission.dateOfBirth),
        });
        if (permission.userId) {
          await this.users.update(permission.userId, { ageEligibilityStatus: 'adult' });
        }
      }
    }
    await this.permissions.delete({ deleteAfter: LessThan(now) });
  }

  private async findResume(rawToken: string): Promise<GuardianPermissionEntity> {
    if (!rawToken) throw new RpcException({ code: 'GUARDIAN_RESUME_INVALID' });
    const permission = await this.permissions.findOne({
      where: {
        resumeTokenHash: this.hash(rawToken),
        status: 'approved',
        userId: IsNull(),
        resumeExpiresAt: MoreThan(new Date()),
      },
    });
    if (!permission) throw new RpcException({ code: 'GUARDIAN_RESUME_INVALID' });
    return permission;
  }

  private ageFromDate(dateOfBirth: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) {
      throw new RpcException('A valid date of birth is required');
    }
    const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dateOfBirth) {
      throw new RpcException('A valid date of birth is required');
    }
    const now = new Date();
    if (dob.getTime() > Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
      throw new RpcException('A valid date of birth is required');
    }
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
    return age;
  }

  private isAgeGatedApp(appId?: string): boolean {
    return appId === 'client-interface' || appId === 'local-hub';
  }

  private retentionDateAfterEighteenthBirthday(dateOfBirth: string): Date {
    const eighteenthBirthday = this.eighteenthBirthday(dateOfBirth);
    return new Date(eighteenthBirthday.getTime() + ACTIVE_DELETE_DELAY_MS);
  }

  private eighteenthBirthday(dateOfBirth: string): Date {
    const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
    return new Date(Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()));
  }

  private contextFor(permission: GuardianPermissionEntity): GuardianPermissionContext {
    return {
      appId: permission.appId,
      appName: permission.appName,
      uiBaseUrl: permission.uiBaseUrl,
      from: permission.emailFrom,
      replyTo: permission.replyTo || undefined,
    };
  }

  private async sendWithdrawalLink(permission: GuardianPermissionEntity, rawToken: string): Promise<boolean> {
    const context = this.contextFor(permission);
    const link = this.withdrawalUrl(permission, rawToken);
    const template = renderDomainEmailTemplate({
      domain: context.uiBaseUrl,
      appName: context.appName,
      heading: 'Guardian permission controls',
      body: ['Use this private link if you later withdraw permission. Withdrawing will disable the minor account across Optimistic Tanuki and Towne Square.'],
      action: { label: 'Withdraw permission', url: link },
      note: 'Keep this link private. It remains available while the permission is active.',
      tone: 'security',
    });
    try {
      const result = await this.email.sendEmail({
        to: permission.guardianEmail,
        from: context.from,
        replyTo: context.replyTo,
        subject: `Permission controls — ${context.appName}`,
        text: template.text,
        html: template.html,
      });
      return result.success;
    } catch {
      // The POST response returns the same capability to the guardian browser.
      return false;
    }
  }

  private withdrawalUrl(permission: GuardianPermissionEntity, rawToken: string): string {
    return `${permission.uiBaseUrl.replace(/\/$/, '')}/auth/guardian-consent#withdrawToken=${encodeURIComponent(rawToken)}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
