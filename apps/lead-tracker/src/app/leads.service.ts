import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  EmailService,
  renderDomainEmailTemplate,
} from '@optimistic-tanuki/email';
import {
  Lead,
  LeadFlag,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import {
  LeadQualificationSummary,
  DiscInterviewTurn,
  LeadAuthContext,
  CommitHardwareProposalRequest,
  CreateLeadDto,
  CreateLeadFlagDto,
  CreateLeadTopicDto,
  DEFAULT_LEAD_DISCOVERY_SOURCES,
  LeadDiscoverySource,
  LeadSource,
  LeadTopicDiscoveryIntent,
  UpdateLeadDto,
  UpdateLeadTopicDto,
  LeadStats,
  LeadStatus,
  SendLeadResponseDto,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models/leads-contracts';
import type { AspirationalCompany } from '@optimistic-tanuki/leads-contracts';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadNotificationOutbox } from './entities/lead-notification-outbox.entity';
import { addBusinessHoursForLeadAcknowledgment } from './hai-lead-sla.util';

@Injectable()
export class LeadsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadsService.name);
  private outboxTimer?: ReturnType<typeof setInterval>;
  private outboxDrainInProgress = false;

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadFlag)
    private readonly leadFlagRepository: Repository<LeadFlag>,
    @InjectRepository(LeadTopic)
    private readonly leadTopicRepository: Repository<LeadTopic>,
    @InjectRepository(LeadTopicLink)
    private readonly leadTopicLinkRepository: Repository<LeadTopicLink>,
    @InjectRepository(LeadQualification)
    private readonly qualificationRepository: Repository<LeadQualification>,
    private readonly leadQualificationService: LeadQualificationService,
    private readonly emailService: EmailService,
    @Inject('LEAD_TRACKER_CONNECTION')
    private readonly dataSource: DataSource
  ) {}

  async onModuleInit(): Promise<void> {
    this.outboxTimer = setInterval(() => {
      void this.drainNotificationOutbox();
    }, 15_000);
    this.outboxTimer.unref?.();
    await this.drainNotificationOutbox();
  }

  onModuleDestroy(): void {
    if (this.outboxTimer) {
      clearInterval(this.outboxTimer);
    }
  }

  async findAll(filters?: {
    status?: string;
    source?: string;
    appScope?: string;
    profileId: string;
    ownerConsoleAccess?: boolean;
  }): Promise<Array<Lead & { isFlagged: boolean }>> {
    const query = this.leadRepository.createQueryBuilder('lead');
    query.leftJoinAndSelect('lead.flags', 'flag');
    if (filters?.ownerConsoleAccess && filters.appScope === 'hai') {
      query.andWhere('lead.appScope = :appScope', { appScope: 'hai' });
    } else {
      query.andWhere('lead.profileId = :profileId', {
        profileId: filters?.profileId,
      });
      query.andWhere('lead.appScope != :restrictedAppScope', {
        restrictedAppScope: 'hai',
      });
    }

    if (filters?.status) {
      query.andWhere('lead.status = :status', { status: filters.status });
    }
    if (filters?.source) {
      query.andWhere('lead.source = :source', { source: filters.source });
    }
    if (filters?.appScope) {
      query.andWhere('lead.appScope = :appScope', {
        appScope: filters.appScope,
      });
    }

    const leads = await query
      .orderBy('lead.nextFollowUp', 'ASC')
      .addOrderBy('lead.createdAt', 'DESC')
      .getMany();

    return leads.map((lead) => ({
      ...lead,
      isFlagged: (lead.flags?.length || 0) > 0,
    }));
  }

  /**
   * An id that is not a UUID cannot match a row, and handing it to Postgres
   * raises `invalid input syntax for type uuid` — a 500 for what is really a
   * miss. Treat it as not found, which is what the gateway already turns into
   * a 404.
   */
  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  async findOne(
    id: string,
    profileId: string,
    ownerConsoleAccess = false
  ): Promise<(Lead & { isFlagged: boolean }) | null> {
    if (!this.isUuid(id)) {
      return null;
    }

    const lead = await this.leadRepository.findOne({
      where: ownerConsoleAccess
        ? { id, appScope: 'hai' }
        : { id, profileId, appScope: Not('hai') },
      relations: { flags: true },
    });

    if (!lead) {
      return null;
    }

    return {
      ...lead,
      isFlagged: (lead.flags?.length || 0) > 0,
    };
  }

  async create(
    dto: CreateLeadDto,
    context: LeadAuthContext,
    ownerNotificationRecipients: string[] = []
  ): Promise<Lead> {
    const createdAt = new Date();
    const acknowledgmentDueAt =
      context.appScope === 'hai'
        ? addBusinessHoursForLeadAcknowledgment(createdAt)
        : null;
    const recipients =
      context.appScope === 'hai'
        ? Array.from(
            new Set(
              (ownerNotificationRecipients || [])
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean)
            )
          )
        : [];
    if (context.appScope === 'hai' && recipients.length === 0) {
      this.logger.warn(
        `HAI lead intake has no trusted owner notification recipients for profile ${context.profileId}`
      );
    }

    const savedLead = await this.dataSource.transaction(async (manager) => {
      const leadRepository = manager.getRepository(Lead);
      const lead = leadRepository.create({
        ...dto,
        appScope: context.appScope,
        profileId: context.profileId,
        userId: context.userId,
        dueAt: acknowledgmentDueAt,
        firstPersonalResponseAt: null,
      });
      const saved = await leadRepository.save(lead);
      const outboxRepository = manager.getRepository(LeadNotificationOutbox);
      const intakeMessages = recipients.map((recipientEmail) =>
        this.createNotification(saved, recipientEmail, 'intake', createdAt)
      );
      const breachMessages = acknowledgmentDueAt
        ? recipients.map((recipientEmail) =>
            this.createNotification(
              saved,
              recipientEmail,
              'sla_breach',
              acknowledgmentDueAt
            )
          )
        : [];
      if (intakeMessages.length || breachMessages.length) {
        await outboxRepository.save([...intakeMessages, ...breachMessages]);
      }
      return saved;
    });

    // The lead and all notifications are committed before SMTP is contacted.
    await this.drainNotificationOutbox();
    await this.leadQualificationService
      .analyzeAndSave(savedLead, null)
      .catch((error) =>
        this.leadQualificationService.logFailure(savedLead.id, error)
      );
    return {
      ...savedLead,
      flags: [],
    };
  }

  async commitHardwareProposal(
    request: CommitHardwareProposalRequest
  ): Promise<Lead> {
    const { context, proposal } =
      request || ({} as CommitHardwareProposalRequest);
    if (
      context?.appScope !== 'owner-console' ||
      context?.ownerConsoleAccess !== true ||
      !context.userId?.trim() ||
      !context.profileId?.trim()
    ) {
      throw new ForbiddenException('Verified owner context is required');
    }
    if (
      !proposal?.quoteId?.trim() ||
      !proposal.customerName?.trim() ||
      !proposal.idempotencyKey?.trim() ||
      !['tier1', 'tier2', 'tier3'].includes(proposal.tier) ||
      !Number.isFinite(proposal.total) ||
      proposal.total < 0 ||
      !/^[A-Z]{3}$/.test(proposal.currency) ||
      !proposal.terms ||
      typeof proposal.terms !== 'object' ||
      Array.isArray(proposal.terms)
    ) {
      throw new BadRequestException('Hardware proposal details are invalid');
    }

    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalize(item)])
        );
      }
      return value;
    };
    const proposalHash = createHash('sha256')
      .update(
        JSON.stringify(
          canonicalize({
            ownerUserId: context.userId,
            ownerProfileId: context.profileId,
            ...proposal,
          })
        )
      )
      .digest('hex');

    const assertSameProposal = (existing: Lead): Lead => {
      if (
        existing.proposalIdempotencyKey !== proposal.idempotencyKey ||
        existing.commercialQuoteId !== proposal.quoteId ||
        existing.commercialProposalHash !== proposalHash
      ) {
        throw new BadRequestException(
          'Idempotency key was already used for another proposal'
        );
      }
      return existing;
    };

    try {
      return await this.dataSource.transaction(async (manager) => {
        const leadRepository = manager.getRepository(Lead);
        const existing = await leadRepository.findOne({
          where: [
            { proposalIdempotencyKey: proposal.idempotencyKey },
            { commercialQuoteId: proposal.quoteId },
          ],
        });
        if (existing) {
          return assertSameProposal(existing);
        }

        const lead = leadRepository.create({
          name: proposal.customerName.trim(),
          email: proposal.customerEmail?.trim() || undefined,
          phone: proposal.customerPhone?.trim() || undefined,
          source: LeadSource.OTHER,
          value: proposal.total,
          notes: `Accepted ${proposal.tier} hardware proposal for quote ${proposal.quoteId}.`,
          contactSubject: `Hardware proposal ${proposal.tier}`,
          contactSourceLabel: 'HAI',
          appScope: 'hai',
          profileId: context.profileId,
          userId: context.userId,
          dueAt: null,
          firstPersonalResponseAt: null,
          commercialQuoteId: proposal.quoteId,
          proposalIdempotencyKey: proposal.idempotencyKey,
          commercialProposalHash: proposalHash,
          hardwareTier: proposal.tier,
          commercialCurrency: proposal.currency,
          acceptedTerms: proposal.terms,
        });
        return leadRepository.save(lead);
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      // Another transaction can pass the pre-insert lookup before it commits.
      // Reload from the base repository after that transaction wins its unique
      // insert so identical client retries still return the created lead.
      const existing = await this.leadRepository.findOne({
        where: [
          { proposalIdempotencyKey: proposal.idempotencyKey },
          { commercialQuoteId: proposal.quoteId },
        ],
      });
      if (!existing) {
        throw error;
      }
      return assertSameProposal(existing);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const candidate = error as {
      code?: unknown;
      driverError?: { code?: unknown };
    };
    return (
      candidate.code === '23505' || candidate.driverError?.code === '23505'
    );
  }

  async update(
    id: string,
    dto: UpdateLeadDto,
    profileId: string,
    ownerConsoleAccess = false
  ): Promise<(Lead & { isFlagged: boolean }) | null> {
    await this.leadRepository.update(
      ownerConsoleAccess
        ? { id, appScope: 'hai' }
        : { id, profileId, appScope: Not('hai') },
      dto
    );
    return this.findOne(id, profileId, ownerConsoleAccess);
  }

  async delete(id: string, profileId: string): Promise<{ deleted: number }> {
    // Returns a value rather than void: a microservice handler that resolves
    // with nothing completes its observable without emitting, and the
    // gateway's `firstValueFrom` then rejects with an EmptyError that surfaces
    // as a 500 on a delete that actually succeeded.
    const result = await this.dataSource.transaction(async (manager) => {
      const deletion = await manager.getRepository(Lead).delete({
        id,
        profileId,
        appScope: Not('hai'),
      });
      if (deletion.affected) {
        await manager
          .getRepository(LeadNotificationOutbox)
          .update({ leadId: id, status: 'pending' }, { status: 'suppressed' });
      }
      return deletion;
    });
    return { deleted: result.affected ?? 0 };
  }

  async sendResponse(
    id: string,
    dto: SendLeadResponseDto,
    context: LeadAuthContext
  ): Promise<{
    lead: (Lead & { isFlagged: boolean }) | null;
    delivery: { success: boolean; error?: string };
  }> {
    const ownerConsoleAccess =
      context.ownerConsoleAccess === true &&
      context.appScope === 'owner-console';
    const lead = await this.findOne(id, context.profileId, ownerConsoleAccess);
    if (!lead) {
      return {
        lead: null,
        delivery: { success: false, error: `Lead ${id} not found` },
      };
    }

    if (
      ownerConsoleAccess &&
      dto.toEmail?.trim() &&
      dto.toEmail.trim().toLowerCase() !== lead.email?.trim().toLowerCase()
    ) {
      return {
        lead,
        delivery: {
          success: false,
          error: 'HAI owner responses must be addressed to the lead email.',
        },
      };
    }
    const toEmail = ownerConsoleAccess
      ? lead.email?.trim()
      : dto.toEmail?.trim() || lead.email?.trim();
    if (!toEmail) {
      return {
        lead,
        delivery: {
          success: false,
          error: 'Lead does not have a recipient email address',
        },
      };
    }

    const template = renderDomainEmailTemplate({
      domain: process.env.SMTP_FROM || 'optimistic-tanuki.com',
      appName: 'Lead Tracker',
      heading: dto.subject,
      body: dto.message.split(/\r?\n/).filter(Boolean),
    });
    const delivery = await this.emailService.sendEmail({
      to: toEmail,
      subject: dto.subject,
      text: template.text,
      html: template.html,
      replyTo: process.env.SMTP_FROM,
    });

    const responseAt = new Date();
    const responseTimestamp = responseAt.toISOString();
    const responseHeader = delivery.success
      ? `Operator response sent: ${responseTimestamp}`
      : `Operator response failed: ${responseTimestamp}`;
    const responseBody = delivery.success
      ? [dto.message]
      : [delivery.error || 'Email delivery failed'];
    const responseNote = [
      '',
      '---',
      responseHeader,
      `Subject: ${dto.subject}`,
      ...responseBody,
    ].join('\n');

    const leadCriteria = ownerConsoleAccess
      ? { id, appScope: 'hai' }
      : { id, profileId: context.profileId, appScope: Not('hai') };
    const responseUpdate = {
      notes: `${lead.notes || ''}${responseNote}`.trim(),
      status: delivery.success
        ? dto.status || LeadStatus.CONTACTED
        : lead.status,
      nextFollowUp: delivery.success
        ? dto.nextFollowUp || lead.nextFollowUp
        : lead.nextFollowUp,
      lastRespondedAt: delivery.success ? responseAt : lead.lastRespondedAt,
      ...(delivery.success && ownerConsoleAccess
        ? {
            firstPersonalResponseAt: () =>
              'COALESCE("firstPersonalResponseAt", CURRENT_TIMESTAMP)',
          }
        : {}),
    };
    if (delivery.success) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Lead).update(leadCriteria, responseUpdate);
        const firstResponse = lead.firstPersonalResponseAt || responseAt;
        if (
          ownerConsoleAccess &&
          lead.dueAt &&
          firstResponse.getTime() <= lead.dueAt.getTime()
        ) {
          await manager
            .getRepository(LeadNotificationOutbox)
            .update(
              { leadId: id, eventType: 'sla_breach', status: 'pending' },
              { status: 'suppressed' }
            );
        }
      });
    } else {
      await this.leadRepository.update(leadCriteria, responseUpdate);
    }

    return {
      lead: await this.findOne(id, context.profileId, ownerConsoleAccess),
      delivery,
    };
  }

  private createNotification(
    lead: Lead,
    recipientEmail: string,
    eventType: 'intake' | 'sla_breach',
    nextAttemptAt: Date
  ): LeadNotificationOutbox {
    const isBreach = eventType === 'sla_breach';
    const subject = isBreach
      ? `HAI response SLA missed: ${lead.contactSubject || lead.name}`
      : `New HAI inquiry: ${lead.contactSubject || lead.name}`;
    const template = renderDomainEmailTemplate({
      domain: process.env.SMTP_FROM || 'optimistic-tanuki.com',
      appName: 'HAI Lead Intake',
      heading: subject,
      body: isBreach
        ? [
            `No personal response was recorded for ${lead.name} by the one business-hour acknowledgment deadline.`,
            `Lead ID: ${lead.id}`,
            `Contact: ${lead.email || 'No email supplied'}`,
          ]
        : [
            `A new contact inquiry was received from ${lead.name}.`,
            `Email: ${lead.email || 'No email supplied'}`,
            lead.company ? `Company: ${lead.company}` : '',
            `Subject: ${lead.contactSubject || 'General inquiry'}`,
            lead.contactMessage || '',
            `Lead ID: ${lead.id}`,
          ].filter(Boolean),
    });

    return {
      leadId: lead.id,
      recipientEmail,
      eventType,
      subject,
      text: template.text,
      html: template.html,
      status: 'pending',
      attempts: 0,
      nextAttemptAt,
      lastError: null,
      sentAt: null,
    } as LeadNotificationOutbox;
  }

  private async drainNotificationOutbox(): Promise<void> {
    if (this.outboxDrainInProgress) {
      return;
    }

    this.outboxDrainInProgress = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const outboxRepository = manager.getRepository(LeadNotificationOutbox);
        const dueNotifications = await outboxRepository.find({
          where: {
            status: 'pending',
            nextAttemptAt: LessThanOrEqual(new Date()),
          },
          order: { nextAttemptAt: 'ASC', createdAt: 'ASC' },
          take: 25,
        });

        for (const candidate of dueNotifications) {
          // All dispatch and response paths lock the lead before the outbox
          // row, then recheck status under lock to prevent duplicate sends.
          const lead = await manager.getRepository(Lead).findOne({
            where: { id: candidate.leadId },
            lock: { mode: 'pessimistic_write' },
          });
          const notification = await outboxRepository.findOne({
            where: { id: candidate.id, status: 'pending' },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !notification ||
            notification.nextAttemptAt.getTime() > Date.now()
          ) {
            continue;
          }
          if (
            notification.eventType === 'sla_breach' &&
            (!lead ||
              (lead.firstPersonalResponseAt &&
                lead.dueAt &&
                lead.firstPersonalResponseAt.getTime() <= lead.dueAt.getTime()))
          ) {
            notification.status = 'suppressed';
            await outboxRepository.save(notification);
            continue;
          }

          try {
            const delivery = await this.emailService.sendEmail({
              to: notification.recipientEmail,
              subject: notification.subject,
              text: notification.text,
              html: notification.html,
              replyTo: process.env.SMTP_FROM,
            });
            if (delivery.success) {
              notification.status = 'sent';
              notification.sentAt = new Date();
              notification.lastError = null;
            } else {
              this.scheduleNotificationRetry(
                notification,
                delivery.error || 'Email delivery failed'
              );
            }
          } catch (error) {
            this.scheduleNotificationRetry(
              notification,
              error instanceof Error ? error.message : String(error)
            );
          }
          await outboxRepository.save(notification);
        }
      });
    } catch (error) {
      this.logger.error(
        'Failed to drain lead notification outbox',
        error instanceof Error ? error.stack : String(error)
      );
    } finally {
      this.outboxDrainInProgress = false;
    }
  }

  private scheduleNotificationRetry(
    notification: LeadNotificationOutbox,
    error: string
  ): void {
    notification.attempts += 1;
    notification.lastError = error;
    const retryDelayMs = Math.min(
      60 * 60 * 1000,
      60 * 1000 * 2 ** Math.min(notification.attempts - 1, 6)
    );
    notification.nextAttemptAt = new Date(Date.now() + retryDelayMs);
  }

  async findAllTopics(profileId: string): Promise<LeadTopic[]> {
    const topics = await this.leadTopicRepository.find({
      where: { profileId },
      order: { enabled: 'DESC', updatedAt: 'DESC', name: 'ASC' },
    });

    if (!topics.length) {
      return topics;
    }

    const links = await this.leadTopicLinkRepository.find({
      where: topics.map((topic) => ({ topicId: topic.id })),
    });
    const leadIds = Array.from(new Set(links.map((link) => link.leadId)));
    const qualifications = leadIds.length
      ? await this.qualificationRepository.find({
          where: leadIds.map((leadId) => ({ leadId })),
        })
      : [];
    const qualificationByLeadId = new Map(
      qualifications.map((qualification) => [
        qualification.leadId,
        qualification,
      ])
    );

    return topics.map((topic) => {
      const topicQualifications = links
        .filter((link) => link.topicId === topic.id)
        .map((link) => qualificationByLeadId.get(link.leadId))
        .filter((qualification): qualification is LeadQualification =>
          Boolean(qualification)
        );

      return {
        ...topic,
        qualificationSummary:
          this.buildQualificationSummary(topicQualifications),
      };
    });
  }

  async findTopicById(
    id: string,
    profileId: string
  ): Promise<LeadTopic | null> {
    return this.leadTopicRepository.findOneBy({ id, profileId });
  }

  async createTopic(
    dto: CreateLeadTopicDto,
    context: LeadAuthContext
  ): Promise<LeadTopic> {
    const sources = this.normalizeTopicSources(dto.sources);
    const topic = this.leadTopicRepository.create({
      ...dto,
      appScope: context.appScope,
      profileId: context.profileId,
      userId: context.userId,
      description: dto.description || '',
      excludedTerms: this.normalizeTopicTerms(dto.excludedTerms),
      discoveryIntent:
        dto.discoveryIntent || LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources,
      aspirationalCompanies:
        this.normalizeAspirationalCompanies(dto.aspirationalCompanies) ?? [],
      googleMapsCities: this.normalizeTopicGoogleMapsList(
        dto.googleMapsCities,
        sources
      ),
      googleMapsTypes: this.normalizeTopicGoogleMapsList(
        dto.googleMapsTypes,
        sources
      ),
      googleMapsLocation: this.normalizeTopicGoogleMapsLocation(
        dto.googleMapsLocation,
        sources
      ),
      googleMapsRadiusMiles: this.normalizeTopicGoogleMapsRadiusMiles(
        dto.googleMapsRadiusMiles,
        sources
      ),
      leadCount: dto.leadCount || 0,
      lastRun: dto.lastRun ? new Date(dto.lastRun) : null,
    });

    return this.leadTopicRepository.save(topic);
  }

  async updateTopic(
    id: string,
    dto: UpdateLeadTopicDto,
    profileId: string
  ): Promise<LeadTopic | null> {
    const existing = await this.leadTopicRepository.findOneBy({
      id,
      profileId,
    });
    if (!existing) {
      return null;
    }
    const nextSources =
      dto.sources !== undefined
        ? this.normalizeTopicSources(dto.sources)
        : undefined;

    await this.leadTopicRepository.update(
      { id, profileId },
      {
        ...dto,
        excludedTerms: this.normalizeTopicTerms(dto.excludedTerms),
        discoveryIntent: dto.discoveryIntent,
        sources: nextSources,
        aspirationalCompanies: this.normalizeAspirationalCompanies(
          dto.aspirationalCompanies
        ),
        googleMapsCities: this.normalizeTopicGoogleMapsList(
          dto.googleMapsCities,
          nextSources
        ),
        googleMapsTypes: this.normalizeTopicGoogleMapsList(
          dto.googleMapsTypes,
          nextSources
        ),
        googleMapsLocation: this.normalizeTopicGoogleMapsLocation(
          dto.googleMapsLocation,
          nextSources
        ),
        googleMapsRadiusMiles: this.normalizeTopicGoogleMapsRadiusMiles(
          dto.googleMapsRadiusMiles,
          nextSources
        ),
        lastRun: dto.lastRun ? new Date(dto.lastRun) : dto.lastRun,
      }
    );
    return this.leadTopicRepository.findOneBy({ id, profileId });
  }

  async deleteTopic(
    id: string,
    profileId: string
  ): Promise<{ deleted: number }> {
    // Returns a value for the same reason as `delete` above: a void handler
    // leaves the gateway's `firstValueFrom` with nothing to emit.
    const result = await this.leadTopicRepository.delete({ id, profileId });
    return { deleted: result.affected ?? 0 };
  }

  /**
   * Only entries with a real provider and token are kept. A blank token would
   * produce a request to a nonexistent board on every discovery run.
   */
  private normalizeAspirationalCompanies(
    companies?: AspirationalCompany[] | null
  ): AspirationalCompany[] | undefined {
    if (companies === undefined) {
      return undefined;
    }
    if (companies === null) {
      return [];
    }

    const seen = new Set<string>();
    return companies
      .filter(
        (company) =>
          (company?.provider === 'greenhouse' ||
            company?.provider === 'lever') &&
          Boolean(company?.token?.trim())
      )
      .map((company) => ({
        provider: company.provider,
        token: company.token.trim(),
        label: (company.label || company.token).trim(),
      }))
      .filter((company) => {
        const key = `${company.provider}:${company.token}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  private normalizeTopicSources(
    sources?: LeadDiscoverySource[]
  ): LeadDiscoverySource[] {
    const normalized = Array.from(new Set((sources || []).filter(Boolean)));
    return normalized.length ? normalized : [...DEFAULT_LEAD_DISCOVERY_SOURCES];
  }

  private normalizeTopicTerms(values?: string[]): string[] | undefined {
    if (!values) {
      return undefined;
    }

    return Array.from(
      new Set(
        values
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0)
      )
    );
  }

  private normalizeTopicGoogleMapsList(
    values: string[] | undefined,
    sources?: LeadDiscoverySource[]
  ): string[] | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    if (!values?.length) {
      return null;
    }

    const normalized = Array.from(
      new Set(
        values.map((value) => value.trim()).filter((value) => value.length > 0)
      )
    );

    return normalized.length ? normalized : null;
  }

  private normalizeTopicGoogleMapsLocation(
    value: string | undefined,
    sources?: LeadDiscoverySource[]
  ): string | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeTopicGoogleMapsRadiusMiles(
    value: number | undefined,
    sources?: LeadDiscoverySource[]
  ): number | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.round(value);
  }

  async findFlagsByLead(
    leadId: string,
    profileId: string
  ): Promise<LeadFlag[]> {
    return this.leadFlagRepository.find({
      where: { leadId, profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async createFlag(
    leadId: string,
    dto: CreateLeadFlagDto,
    context: LeadAuthContext
  ): Promise<LeadFlag> {
    const flag = this.leadFlagRepository.create({
      leadId,
      reasons: dto.reasons,
      notes: dto.notes,
      profileId: context.profileId,
      userId: context.userId,
    });

    return this.leadFlagRepository.save(flag);
  }

  async getStats(profileId: string): Promise<LeadStats> {
    const leads = await this.leadRepository.findBy({ profileId });
    const leadIds = leads.map((lead) => lead.id);
    const qualifications = await this.qualificationRepository.find();
    const scopedQualifications = qualifications.filter((qualification) =>
      leadIds.includes(qualification.leadId)
    );

    const byStatus = Object.values(LeadStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {}
    );

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    }

    return {
      total: leads.length,
      autoDiscovered: leads.filter((l) => l.isAutoDiscovered).length,
      manual: leads.filter((l) => !l.isAutoDiscovered).length,
      totalValue: leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
      followUpsDue: leads.filter((l) => {
        if (!l.nextFollowUp) return false;
        if (l.status === LeadStatus.WON || l.status === LeadStatus.LOST)
          return false;
        return new Date(l.nextFollowUp) <= new Date();
      }).length,
      byStatus,
      qualification: this.buildQualificationSummary(scopedQualifications),
    };
  }

  async saveOnboardingProfile(
    profile: UserOnboardingProfile,
    context: LeadAuthContext,
    discTranscript: DiscInterviewTurn[] = []
  ) {
    return this.leadQualificationService.saveOnboardingProfile(
      profile,
      context,
      discTranscript
    );
  }

  private buildQualificationSummary(
    qualifications: LeadQualification[]
  ): LeadQualificationSummary {
    const byClassification = {
      'strong-match': 0,
      review: 0,
      'weak-match': 0,
    } as Record<'strong-match' | 'review' | 'weak-match', number>;
    let relevanceTotal = 0;
    let relevanceCount = 0;
    let difficultyTotal = 0;
    let difficultyCount = 0;
    let userFitTotal = 0;
    let userFitCount = 0;
    let missingUserFitCount = 0;

    for (const qualification of qualifications) {
      byClassification[qualification.classification] =
        (byClassification[qualification.classification] || 0) + 1;

      if (typeof qualification.relevanceScore === 'number') {
        relevanceTotal += qualification.relevanceScore;
        relevanceCount++;
      }
      if (typeof qualification.difficultyScore === 'number') {
        difficultyTotal += qualification.difficultyScore;
        difficultyCount++;
      }
      if (typeof qualification.userFitScore === 'number') {
        userFitTotal += qualification.userFitScore;
        userFitCount++;
      } else if (qualification.userFitStatus === 'unavailable') {
        missingUserFitCount++;
      }
    }

    return {
      byClassification,
      averageRelevanceScore: relevanceCount
        ? Math.round(relevanceTotal / relevanceCount)
        : null,
      averageDifficultyScore: difficultyCount
        ? Math.round(difficultyTotal / difficultyCount)
        : null,
      averageUserFitScore: userFitCount
        ? Math.round(userFitTotal / userFitCount)
        : null,
      missingUserFitCount,
    };
  }
}
