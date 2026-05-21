import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lead, LeadTopic, LeadTopicLink } from '@optimistic-tanuki/models/leads-entities';
import {
    DEFAULT_LEAD_DISCOVERY_SOURCES,
    LeadDiscoverySource,
    LeadContactPoint,
    LeadTopicDiagnosticCountsDto,
    LeadTopicDiscoveryIssueDto,
    LeadTopicDiscoveryResultDto,
    LeadTopicDiscoverySeverity,
    LeadTopicProviderResultDto,
    LeadTopicProviderStatus,
} from '@optimistic-tanuki/models/leads-contracts';
import { In, Repository } from 'typeorm';
import { ClutchDiscoveryProvider } from './discovery/clutch-discovery.provider';
import { CrunchbaseDiscoveryProvider } from './discovery/crunchbase-discovery.provider';
import { GoogleMapsDiscoveryProvider } from './discovery/google-maps-discovery.provider';
import { HimalayasDiscoveryProvider } from './discovery/himalayas-discovery.provider';
import { IndeedDiscoveryProvider } from './discovery/indeed-discovery.provider';
import { InternalDiscoveryProvider } from './discovery/internal-discovery.provider';
import { JobicyDiscoveryProvider } from './discovery/jobicy-discovery.provider';
import { JustRemoteDiscoveryProvider } from './discovery/justremote-discovery.provider';
import { RemoteOkDiscoveryProvider } from './discovery/remoteok-discovery.provider';
import { DiscoveredLeadCandidate, ProviderSearchResult, TopicDiscoveryProvider } from './discovery/discovery.types';
import {
    extractContactPoints,
    markPrimaryContact,
    mergeContactPoints,
    selectPrimaryContactValue,
} from './discovery/source-provider.util';
import { WeWorkRemotelyDiscoveryProvider } from './discovery/weworkremotely-discovery.provider';
import { LeadQualificationService } from './lead-qualification.service';

@Injectable()
export class DiscoveryService {
    private readonly logger = new Logger(DiscoveryService.name);
    private readonly queue: string[] = [];
    private readonly pendingTopics = new Set<string>();
    private readonly latestResults = new Map<string, LeadTopicDiscoveryResultDto>();
    private readonly providerRegistry: Map<LeadDiscoverySource, TopicDiscoveryProvider>;
    private processing = false;

    constructor(
        @InjectRepository(Lead)
        private readonly leadRepository: Repository<Lead>,
        @InjectRepository(LeadTopic)
        private readonly leadTopicRepository: Repository<LeadTopic>,
        @InjectRepository(LeadTopicLink)
        private readonly leadTopicLinkRepository: Repository<LeadTopicLink>,
        private readonly internalDiscoveryProvider: InternalDiscoveryProvider,
        private readonly remoteOkDiscoveryProvider: RemoteOkDiscoveryProvider,
        private readonly himalayasDiscoveryProvider: HimalayasDiscoveryProvider,
        private readonly weWorkRemotelyDiscoveryProvider: WeWorkRemotelyDiscoveryProvider,
        private readonly justRemoteDiscoveryProvider: JustRemoteDiscoveryProvider,
        private readonly jobicyDiscoveryProvider: JobicyDiscoveryProvider,
        private readonly clutchDiscoveryProvider: ClutchDiscoveryProvider,
        private readonly crunchbaseDiscoveryProvider: CrunchbaseDiscoveryProvider,
        private readonly indeedDiscoveryProvider: IndeedDiscoveryProvider,
        private readonly googleMapsDiscoveryProvider: GoogleMapsDiscoveryProvider,
        private readonly leadQualificationService: LeadQualificationService
    ) {
        this.providerRegistry = new Map<LeadDiscoverySource, TopicDiscoveryProvider>([
            [LeadDiscoverySource.REMOTE_OK, this.remoteOkDiscoveryProvider],
            [LeadDiscoverySource.HIMALAYAS, this.himalayasDiscoveryProvider],
            [LeadDiscoverySource.WE_WORK_REMOTELY, this.weWorkRemotelyDiscoveryProvider],
            [LeadDiscoverySource.JUST_REMOTE, this.justRemoteDiscoveryProvider],
            [LeadDiscoverySource.JOBICY, this.jobicyDiscoveryProvider],
            [LeadDiscoverySource.CLUTCH, this.clutchDiscoveryProvider],
            [LeadDiscoverySource.CRUNCHBASE, this.crunchbaseDiscoveryProvider],
            [LeadDiscoverySource.INDEED, this.indeedDiscoveryProvider],
            [LeadDiscoverySource.GOOGLE_MAPS, this.googleMapsDiscoveryProvider],
        ]);
    }

    async request(
        topicId: string,
        profileId?: string
    ): Promise<LeadTopicDiscoveryResultDto | null> {
        const topic = await this.leadTopicRepository.findOneBy(
            profileId ? { id: topicId, profileId } : { id: topicId }
        );
        if (!topic) {
            return null;
        }

        return this.enqueue(topic);
    }

    async getStatus(
        topicId: string,
        profileId?: string
    ): Promise<LeadTopicDiscoveryResultDto | null> {
        const topic = await this.leadTopicRepository.findOneBy(
            profileId ? { id: topicId, profileId } : { id: topicId }
        );
        if (!topic) {
            return null;
        }

        return this.latestResults.get(topicId) || {
            topicId,
            linkedLeadCount: topic.leadCount,
            addedCount: 0,
            removedCount: 0,
            queued: false,
            status: 'idle',
            lastRun: topic.lastRun?.toISOString(),
            providerResults: [],
            message: topic.lastRun
                ? 'No discovery is currently running for this topic.'
                : 'Discovery has not been run yet for this topic.',
            severity: 'info',
            summaryTitle: topic.lastRun ? 'Discovery idle' : 'Discovery not started',
            summaryBody: topic.lastRun
                ? 'No discovery is currently running for this topic.'
                : 'Discovery has not been run yet for this topic.',
            actionItems: [],
            diagnosticCounts: {
                errors: 0,
                warnings: 0,
                providersWithIssues: 0,
            },
        };
    }

    enqueue(topic: LeadTopic): LeadTopicDiscoveryResultDto {
        if (!this.pendingTopics.has(topic.id)) {
            this.pendingTopics.add(topic.id);
            this.queue.push(topic.id);
            this.startWorker();
        }

        const queuedResult: LeadTopicDiscoveryResultDto = {
            topicId: topic.id,
            linkedLeadCount: topic.leadCount,
            addedCount: 0,
            removedCount: 0,
            queued: true,
            status: 'queued',
            lastRun: topic.lastRun?.toISOString(),
            providerResults: this.latestResults.get(topic.id)?.providerResults || [],
            message: 'Discovery has been queued and will run in the background.',
            severity: 'info',
            summaryTitle: 'Discovery queued',
            summaryBody: 'Discovery has been queued and will run in the background.',
            actionItems: [],
            diagnosticCounts: {
                errors: 0,
                warnings: 0,
                providersWithIssues: 0,
            },
        };

        this.latestResults.set(topic.id, queuedResult);
        return queuedResult;
    }

    async runNow(topicId: string): Promise<LeadTopicDiscoveryResultDto | null> {
        return this.processTopicDiscovery(topicId);
    }

    private startWorker() {
        if (this.processing) return;
        this.processing = true;
        setImmediate(() =>
            this.processLoop().catch((error) => {
                this.logger.error('Discovery worker failed', error);
                this.processing = false;
            })
        );
    }

    private async processLoop() {
        while (this.queue.length) {
            const topicId = this.queue.shift();
            if (!topicId) {
                continue;
            }

            try {
                const topic = await this.leadTopicRepository.findOneBy({ id: topicId });
                if (topic) {
                    this.latestResults.set(topicId, {
                        topicId,
                        linkedLeadCount: topic.leadCount,
                        addedCount: 0,
                        removedCount: 0,
                        queued: true,
                        status: 'running',
                        lastRun: topic.lastRun?.toISOString(),
                        providerResults: this.latestResults.get(topicId)?.providerResults || [],
                        message: 'Discovery is running for this topic.',
                        severity: 'info',
                        summaryTitle: 'Discovery running',
                        summaryBody: 'Discovery is running for this topic.',
                        actionItems: [],
                        diagnosticCounts: {
                            errors: 0,
                            warnings: 0,
                            providersWithIssues: 0,
                        },
                    });
                }
                await this.processTopicDiscovery(topicId);
            } catch (error) {
                this.logger.error(`Discovery failed for topic ${topicId}`, error);
                this.latestResults.set(topicId, {
                    topicId,
                    linkedLeadCount: 0,
                    addedCount: 0,
                    removedCount: 0,
                    queued: false,
                    status: 'failed',
                    providerResults: [],
                    message: `Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: 'error',
                    summaryTitle: 'Discovery failed',
                    summaryBody: error instanceof Error ? error.message : 'Unknown error',
                    actionItems: ['Retry discovery after checking the topic configuration and provider settings.'],
                    diagnosticCounts: {
                        errors: 1,
                        warnings: 0,
                        providersWithIssues: 1,
                    },
                });
            } finally {
                this.pendingTopics.delete(topicId);
            }
        }

        this.processing = false;
    }

    private async processTopicDiscovery(
        topicId: string
    ): Promise<LeadTopicDiscoveryResultDto | null> {
        const topic = await this.leadTopicRepository.findOneBy({ id: topicId });
        if (!topic) {
            this.logger.warn(`Discovery requested for missing topic ${topicId}`);
            return null;
        }

        this.logger.log(
            `Starting discovery for topic ${topic.id} (${topic.name}) using sources: ${this.normalizeSources(topic.sources).join(', ')}`
        );

        if (!topic.enabled) {
            this.logger.log(`Skipping discovery for disabled topic ${topic.id}`);
            const skippedResult: LeadTopicDiscoveryResultDto = {
                topicId,
                linkedLeadCount: topic.leadCount,
                addedCount: 0,
                removedCount: 0,
                queued: false,
                status: 'skipped',
                skipped: true,
                lastRun: topic.lastRun?.toISOString(),
                providerResults: [],
                message: 'Topic is disabled; discovery skipped.',
                severity: 'info',
                summaryTitle: 'Topic disabled',
                summaryBody: 'Topic is disabled; discovery skipped.',
                actionItems: ['Enable the topic to run discovery again.'],
                diagnosticCounts: {
                    errors: 0,
                    warnings: 0,
                    providersWithIssues: 0,
                },
            };

            this.latestResults.set(topicId, skippedResult);
            return skippedResult;
        }

        const { matches: matchedResults, providerResults } = await this.discoverCandidates(topic);
        await this.persistDiscoveredLeads(matchedResults, topic);
        const existingLinks = await this.leadTopicLinkRepository.find({
            where: { topicId },
        });

        const matchedLeadIds = new Set(matchedResults.map((entry) => entry.lead.id));
        const autoLinks = existingLinks.filter((link) => link.linkType === 'auto');
        const manualLinks = existingLinks.filter((link) => link.linkType !== 'auto');
        const existingLinkLeadIds = new Set(existingLinks.map((link) => link.leadId));

        const newLinks = matchedResults
            .filter((entry) => !existingLinkLeadIds.has(entry.lead.id))
            .map((entry) =>
                this.leadTopicLinkRepository.create({
                    leadId: entry.lead.id,
                    topicId,
                    linkType: 'auto',
                    sourceProvider: entry.providerName,
                    matchedKeywords: entry.matchedKeywords,
                })
            );

        if (newLinks.length) {
            await this.leadTopicLinkRepository.save(newLinks);
        }

        const linksToRefresh = autoLinks.filter((link) => matchedLeadIds.has(link.leadId));
        for (const link of linksToRefresh) {
            const match = matchedResults.find((entry) => entry.lead.id === link.leadId);
            link.matchedKeywords = match?.matchedKeywords || [];
            link.sourceProvider = match?.providerName || 'internal';
        }
        if (linksToRefresh.length) {
            await this.leadTopicLinkRepository.save(linksToRefresh);
        }

        const staleAutoLinks = autoLinks.filter((link) => !matchedLeadIds.has(link.leadId));
        if (staleAutoLinks.length) {
            await this.leadTopicLinkRepository.remove(staleAutoLinks);
        }

        const linkedLeadCount = manualLinks.length + linksToRefresh.length + newLinks.length;
        const lastRun = new Date();

        await this.leadTopicRepository.update(topicId, {
            lastRun,
            leadCount: linkedLeadCount,
        });

        this.logger.log(
            `Completed discovery for topic ${topic.id}: matched=${matchedResults.length} added=${newLinks.length} removed=${staleAutoLinks.length} linked=${linkedLeadCount}`
        );

        const diagnostics = this.buildDiscoveryDiagnostics(matchedResults.length, providerResults);
        const result: LeadTopicDiscoveryResultDto = {
            topicId,
            linkedLeadCount,
            addedCount: newLinks.length,
            removedCount: staleAutoLinks.length,
            queued: false,
            status: 'completed',
            lastRun: lastRun.toISOString(),
            providerResults,
            message: diagnostics.message,
            severity: diagnostics.severity,
            summaryTitle: diagnostics.summaryTitle,
            summaryBody: diagnostics.summaryBody,
            actionItems: diagnostics.actionItems,
            diagnosticCounts: diagnostics.diagnosticCounts,
        };

        this.latestResults.set(topicId, result);
        return result;
    }

    private async discoverCandidates(topic: LeadTopic): Promise<{
        matches: DiscoveredLeadCandidate[];
        providerResults: LeadTopicProviderResultDto[];
    }> {
        const providerResponses = await Promise.all(
            this.getProvidersForTopic(topic).map(async (provider) => {
                try {
                    const result = await provider.search(topic);
                    this.logger.debug(
                        `Provider ${provider.providerName} returned ${result.candidates.length} candidate(s) for topic ${topic.id}`
                    );
                    return {
                        providerName: provider.providerName,
                        result,
                    };
                } catch (error) {
                    this.logger.error(
                        `Provider ${provider.providerName} failed for topic ${topic.id}`,
                        error instanceof Error ? error.stack : String(error)
                    );
                    return {
                        providerName: provider.providerName,
                        result: {
                            candidates: [],
                            warnings: [`Provider failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                            queries: [],
                        } as ProviderSearchResult,
                    };
                }
            })
        );

        const existingLeads = await this.leadRepository.findBy({
            profileId: topic.profileId,
        });
        const existingLeadsByFingerprint = new Map<string, Lead>();
        existingLeads.forEach((lead) => {
            const fingerprint = this.buildLeadFingerprint(lead);
            if (!existingLeadsByFingerprint.has(fingerprint)) {
                existingLeadsByFingerprint.set(fingerprint, lead);
            }
        });

        const deduped = new Map<string, DiscoveredLeadCandidate>();

        for (const providerResponse of providerResponses) {
            for (const match of providerResponse.result.candidates) {
                const enrichedLead = await this.enrichLeadContacts(match.lead);
                const alignedCandidate = this.alignCandidateToExistingLead(
                    {
                        ...match,
                        lead: enrichedLead,
                    },
                    existingLeadsByFingerprint
                );
                const dedupeKey = this.buildLeadFingerprint(alignedCandidate.lead);
                const existingCandidate = deduped.get(dedupeKey);
                if (!existingCandidate) {
                    deduped.set(dedupeKey, alignedCandidate);
                    continue;
                }

                deduped.set(dedupeKey, this.mergeCandidates(existingCandidate, alignedCandidate));
            }
        }

        const matches = Array.from(deduped.values());
        if (!matches.length) {
            this.logger.log(`Discovery found no matching leads for topic ${topic.id}`);
        }

        return {
            matches,
            providerResults: providerResponses.map((providerResponse) => ({
                providerName: providerResponse.providerName,
                status: this.determineProviderStatus(
                    providerResponse.result.candidates.length,
                    providerResponse.result.warnings
                ),
                candidateCount: providerResponse.result.candidates.length,
                queries: providerResponse.result.queries,
                warnings: providerResponse.result.warnings,
                issues: (providerResponse.result.warnings || []).map((warning) =>
                    this.classifyProviderIssue(providerResponse.providerName, warning)
                ),
            })),
        };
    }

    private alignCandidateToExistingLead(
        candidate: DiscoveredLeadCandidate,
        existingLeadsByFingerprint: Map<string, Lead>
    ): DiscoveredLeadCandidate {
        const fingerprint = this.buildLeadFingerprint(candidate.lead);
        const existingLead = existingLeadsByFingerprint.get(fingerprint);

        if (!existingLead) {
            return candidate;
        }

        return {
            ...candidate,
            lead: {
                ...candidate.lead,
                ...existingLead,
                id: existingLead.id,
                name: existingLead.name || candidate.lead.name,
                company: existingLead.company || candidate.lead.company,
                notes: existingLead.notes || candidate.lead.notes,
                originalPostingUrl:
                    existingLead.originalPostingUrl || candidate.lead.originalPostingUrl,
                contacts: this.finalizeContacts(
                    mergeContactPoints(existingLead.contacts, candidate.lead.contacts),
                    existingLead.email || candidate.lead.email,
                    existingLead.phone || candidate.lead.phone
                ),
                email: existingLead.email || candidate.lead.email,
                phone: existingLead.phone || candidate.lead.phone,
                searchKeywords: Array.from(
                    new Set([...(existingLead.searchKeywords || []), ...(candidate.lead.searchKeywords || [])])
                ),
            },
        };
    }

    private mergeCandidates(
        current: DiscoveredLeadCandidate,
        incoming: DiscoveredLeadCandidate
    ): DiscoveredLeadCandidate {
        const preferredLead = this.selectPreferredLead(current.lead, incoming.lead);
        const preferredProvider = current.providerName === 'internal' ? incoming.providerName : current.providerName;

        return {
            lead: {
                ...preferredLead,
                originalPostingUrl:
                    current.lead.originalPostingUrl || incoming.lead.originalPostingUrl,
                contacts: this.finalizeContacts(
                    mergeContactPoints(current.lead.contacts, incoming.lead.contacts),
                    current.lead.email || incoming.lead.email,
                    current.lead.phone || incoming.lead.phone
                ),
                email:
                    current.lead.email ||
                    incoming.lead.email ||
                    selectPrimaryContactValue(
                        mergeContactPoints(current.lead.contacts, incoming.lead.contacts),
                        'email'
                    ),
                phone:
                    current.lead.phone ||
                    incoming.lead.phone ||
                    selectPrimaryContactValue(
                        mergeContactPoints(current.lead.contacts, incoming.lead.contacts),
                        'phone'
                    ),
            },
            providerName: preferredProvider,
            matchedKeywords: Array.from(
                new Set([...(current.matchedKeywords || []), ...(incoming.matchedKeywords || [])])
            ),
        };
    }

    private selectPreferredLead(current: Lead, incoming: Lead): Lead {
        const currentScore = this.scoreLeadQuality(current);
        const incomingScore = this.scoreLeadQuality(incoming);
        return incomingScore > currentScore ? incoming : current;
    }

    private scoreLeadQuality(lead: Lead): number {
        let score = 0;
        if (lead.company) {
            score += 10;
        }
        if (lead.name) {
            score += Math.min(lead.name.length, 40);
        }
        if (lead.notes) {
            score += Math.min(lead.notes.length / 10, 20);
        }
        if (lead.searchKeywords?.length) {
            score += lead.searchKeywords.length * 3;
        }
        return score;
    }

    private buildLeadFingerprint(lead: Pick<Lead, 'name' | 'company'>): string {
        const normalizedCompany = this.normalizeFingerprintPart(lead.company || lead.name || '');
        const normalizedName = this.normalizeFingerprintPart(lead.name || lead.company || '');
        return `${normalizedCompany}|${normalizedName}`;
    }

    private normalizeFingerprintPart(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\b(llc|inc|co|company|corp|corporation|ltd)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private async persistDiscoveredLeads(
        matches: DiscoveredLeadCandidate[],
        topic: LeadTopic
    ): Promise<void> {
        const candidateLeads = matches
            .map((entry) => entry.lead)
            .filter((lead): lead is Lead => Boolean(lead?.id));

        if (!candidateLeads.length) {
            return;
        }

        if (!candidateLeads.length) {
            return;
        }

        const scopedCandidates = candidateLeads.map((lead) => ({
            ...lead,
            appScope: topic.appScope,
            profileId: topic.profileId,
            userId: topic.userId,
        }));

        const existingLeads = await this.leadRepository.findBy({
            id: In(scopedCandidates.map((lead) => lead.id)),
            profileId: topic.profileId,
        });
        const existingLeadIds = new Set(existingLeads.map((lead) => lead.id));
        const savedLeads = await this.leadRepository.save(scopedCandidates);
        for (const lead of savedLeads) {
            if (!existingLeadIds.has(lead.id)) {
                await this.leadQualificationService
                    .analyzeAndSave(lead, topic)
                    .catch((error) =>
                        this.leadQualificationService.logFailure(lead.id, error)
                    );
            }
        }
    }

    private async enrichLeadContacts(lead: Lead): Promise<Lead> {
        let contacts = lead.contacts;

        if (lead.originalPostingUrl) {
            try {
                const response = await fetch(lead.originalPostingUrl, {
                    headers: {
                        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                });

                if (response.ok) {
                    const html = await response.text();
                    contacts = mergeContactPoints(
                        contacts,
                        extractContactPoints(html, lead.originalPostingUrl, 'posting-page')
                    );
                }
            } catch (error) {
                this.logger.debug(
                    `Contact extraction fetch failed for ${lead.originalPostingUrl}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }

        contacts = this.finalizeContacts(contacts, lead.email, lead.phone);

        return {
            ...lead,
            contacts,
            email:
                lead.email ||
                selectPrimaryContactValue(contacts, 'email'),
            phone:
                lead.phone ||
                selectPrimaryContactValue(contacts, 'phone'),
        };
    }

    private finalizeContacts(
        contacts: LeadContactPoint[] | undefined,
        email?: string,
        phone?: string
    ): LeadContactPoint[] | undefined {
        const withEmailPrimary = markPrimaryContact(contacts, 'email', email);
        return markPrimaryContact(withEmailPrimary, 'phone', phone);
    }

    private normalizeSources(sources?: LeadDiscoverySource[]): LeadDiscoverySource[] {
        const normalized = Array.from(new Set((sources || []).filter(Boolean)));
        return normalized.length ? normalized : [...DEFAULT_LEAD_DISCOVERY_SOURCES];
    }

    private buildCompletionMessage(
        matchedCount: number,
        providerResults: LeadTopicProviderResultDto[]
    ): string {
        const warnings = providerResults.flatMap((providerResult) =>
            (providerResult.warnings || []).map((warning) => ({
                providerName: providerResult.providerName,
                warning,
            }))
        );

        if (matchedCount > 0) {
            if (!warnings.length) {
                return `Discovery matched ${matchedCount} candidate lead${matchedCount === 1 ? '' : 's'}.`;
            }

            const summary = warnings
                .slice(0, 2)
                .map((entry) => `${entry.providerName}: ${entry.warning}`)
                .join(' ');
            return `Discovery matched ${matchedCount} candidate lead${matchedCount === 1 ? '' : 's'}. Diagnostics: ${summary}`;
        }

        if (!warnings.length) {
            return 'No matching leads were found for this topic.';
        }

        const summary = warnings
            .slice(0, 3)
            .map((entry) => `${entry.providerName}: ${entry.warning}`)
            .join(' ');
        return `No matching leads were found. Diagnostics: ${summary}`;
    }

    private buildDiscoveryDiagnostics(
        matchedCount: number,
        providerResults: LeadTopicProviderResultDto[]
    ): {
        message: string;
        severity: LeadTopicDiscoverySeverity;
        summaryTitle: string;
        summaryBody: string;
        actionItems: string[];
        diagnosticCounts: LeadTopicDiagnosticCountsDto;
    } {
        const issues = providerResults.flatMap((providerResult) => providerResult.issues || []);
        const actionItems = Array.from(
            new Set(
                issues
                    .map((issue) => issue.action)
                    .filter((action): action is string => Boolean(action))
            )
        );
        const diagnosticCounts: LeadTopicDiagnosticCountsDto = {
            errors: issues.filter((issue) => issue.severity === 'error').length,
            warnings: issues.filter((issue) => issue.severity === 'warning').length,
            providersWithIssues: providerResults.filter(
                (providerResult) => (providerResult.issues || []).length > 0
            ).length,
        };

        if (matchedCount > 0 && !issues.length) {
            return {
                message: this.buildCompletionMessage(matchedCount, providerResults),
                severity: 'success',
                summaryTitle: 'Discovery complete',
                summaryBody: `Discovery matched ${matchedCount} candidate lead${matchedCount === 1 ? '' : 's'}.`,
                actionItems: [],
                diagnosticCounts,
            };
        }

        if (matchedCount > 0 && issues.length) {
            return {
                message: this.buildCompletionMessage(matchedCount, providerResults),
                severity: 'warning',
                summaryTitle: 'Discovery complete with issues',
                summaryBody: `Discovery matched ${matchedCount} candidate lead${matchedCount === 1 ? '' : 's'}, but ${diagnosticCounts.providersWithIssues} provider${diagnosticCounts.providersWithIssues === 1 ? '' : 's'} reported issue${diagnosticCounts.providersWithIssues === 1 ? '' : 's'}.`,
                actionItems,
                diagnosticCounts,
            };
        }

        if (!issues.length) {
            return {
                message: this.buildCompletionMessage(matchedCount, providerResults),
                severity: 'info',
                summaryTitle: 'No leads found',
                summaryBody: 'No matching leads were found for this topic.',
                actionItems: [],
                diagnosticCounts,
            };
        }

        return {
            message: this.buildCompletionMessage(matchedCount, providerResults),
            severity: 'warning',
            summaryTitle: 'Discovery needs attention',
            summaryBody: this.buildIssueSummaryBody(issues),
            actionItems,
            diagnosticCounts,
        };
    }

    private determineProviderStatus(
        candidateCount: number,
        warnings: string[]
    ): LeadTopicProviderStatus {
        if (!warnings.length) {
            return candidateCount > 0 ? 'ok' : 'ok';
        }

        const issues = warnings.map((warning) => this.classifyProviderIssue('provider', warning));
        return issues.some((issue) => issue.severity === 'error') ? 'error' : 'warning';
    }

    private classifyProviderIssue(
        providerName: string,
        warning: string
    ): LeadTopicDiscoveryIssueDto {
        const normalizedWarning = warning.toLowerCase();

        if (normalizedWarning.includes('api key')) {
            return {
                type: 'missing-credentials',
                severity: 'error',
                summary: 'Missing API key',
                detail: `${this.formatProviderLabel(providerName)} could not run because the API key is missing.`,
                action: `Add the ${this.formatProviderLabel(providerName)} API key before running this topic again.`,
            };
        }

        if (
            normalizedWarning.includes('http 404') ||
            normalizedWarning.includes('http 403') ||
            normalizedWarning.includes('http 500') ||
            normalizedWarning.includes('text/html') ||
            normalizedWarning.includes('expected json')
        ) {
            return {
                type: 'upstream-response',
                severity: 'error',
                summary: 'Unexpected provider response',
                detail: `${this.formatProviderLabel(providerName)} returned an unexpected response.`,
                action: `Verify the ${this.formatProviderLabel(providerName)} endpoint or provider configuration before running again.`,
            };
        }

        if (normalizedWarning.includes('provider failed')) {
            return {
                type: 'provider-failure',
                severity: 'error',
                summary: 'Provider request failed',
                detail: `${this.formatProviderLabel(providerName)} failed while running discovery.`,
                action: `Retry discovery after checking ${this.formatProviderLabel(providerName)} availability.`,
            };
        }

        if (
            normalizedWarning.includes('matched blocked terms') ||
            normalizedWarning.includes('excluded')
        ) {
            return {
                type: 'excluded-results',
                severity: 'warning',
                summary: 'Results were filtered out',
                detail: 'Configured excluded terms filtered out the results returned by this provider.',
                action: 'Review excluded terms if this topic is filtering out too many results.',
            };
        }

        if (
            normalizedWarning.includes('no places') ||
            normalizedWarning.includes('no matching')
        ) {
            return {
                type: 'no-results',
                severity: 'warning',
                summary: 'No results matched the topic',
                detail: `${this.formatProviderLabel(providerName)} did not return results that matched this topic.`,
                action: 'Broaden the topic keywords or source filters, then run discovery again.',
            };
        }

        return {
            type: 'other',
            severity: 'warning',
            summary: `${this.formatProviderLabel(providerName)} reported a warning`,
            detail: warning,
        };
    }

    private buildIssueSummaryBody(issues: LeadTopicDiscoveryIssueDto[]): string {
        const primaryIssue = issues[0];
        if (!primaryIssue) {
            return 'Discovery reported issues that need review.';
        }

        return primaryIssue.action
            ? primaryIssue.detail
            : `${primaryIssue.summary}. ${primaryIssue.detail}`;
    }

    private formatProviderLabel(providerName: string): string {
        switch (providerName) {
            case 'remoteok':
                return 'Remote OK';
            case 'weworkremotely':
                return 'We Work Remotely';
            case 'justremote':
                return 'JustRemote';
            case 'google-maps':
                return 'Google Maps';
            default:
                return providerName
                    .split('-')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
        }
    }

    private getProvidersForTopic(topic: LeadTopic): TopicDiscoveryProvider[] {
        const selectedSources = new Set(this.normalizeSources(topic.sources));
        const providers: TopicDiscoveryProvider[] = [this.internalDiscoveryProvider];

        selectedSources.forEach((source) => {
            const provider = this.providerRegistry.get(source);
            if (provider) {
                providers.push(provider);
            }
        });

        return providers;
    }
}
