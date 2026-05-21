import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lead, LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
    DEFAULT_LEAD_DISCOVERY_SOURCES,
    LeadDiscoverySource,
    LeadSource,
} from '@optimistic-tanuki/models/leads-contracts';
import { Repository } from 'typeorm';
import { ProviderSearchResult, TopicDiscoveryProvider } from './discovery.types';

const DISCOVERY_SOURCE_TO_LEAD_SOURCE: Record<LeadDiscoverySource, LeadSource> = {
    [LeadDiscoverySource.REMOTE_OK]: LeadSource.REMOTE_OK,
    [LeadDiscoverySource.HIMALAYAS]: LeadSource.HIMALAYAS,
    [LeadDiscoverySource.WE_WORK_REMOTELY]: LeadSource.WE_WORK_REMOTELY,
    [LeadDiscoverySource.JUST_REMOTE]: LeadSource.JUST_REMOTE,
    [LeadDiscoverySource.JOBICY]: LeadSource.JOBICY,
    [LeadDiscoverySource.CLUTCH]: LeadSource.CLUTCH,
    [LeadDiscoverySource.CRUNCHBASE]: LeadSource.CRUNCHBASE,
    [LeadDiscoverySource.INDEED]: LeadSource.INDEED,
    [LeadDiscoverySource.GOOGLE_MAPS]: LeadSource.GOOGLE_MAPS,
};

@Injectable()
export class InternalDiscoveryProvider implements TopicDiscoveryProvider {
    readonly providerName = 'internal';
    readonly supportedSources = [...DEFAULT_LEAD_DISCOVERY_SOURCES];

    constructor(
        @InjectRepository(Lead)
        private readonly leadRepository: Repository<Lead>
    ) { }

    async search(topic: LeadTopic): Promise<ProviderSearchResult> {
        const normalizedKeywords = this.normalizeKeywords(topic.keywords);
        const allowedSources = new Set(this.normalizeSources(topic.sources));
        const allLeads = await this.leadRepository.find({
            where: {
                profileId: topic.profileId,
                appScope: topic.appScope,
            },
        });

        const candidates = allLeads
            .filter((lead) => allowedSources.has(lead.source))
            .map((lead) => ({
                lead,
                matchedKeywords: this.getMatchedKeywords(lead, normalizedKeywords),
                providerName: this.providerName,
            }))
            .filter((entry) => entry.matchedKeywords.length > 0);

        return {
            candidates,
            warnings: candidates.length ? [] : ['No existing leads matched this topic.'],
            queries: [],
        };
    }

    private normalizeKeywords(keywords: string[]): string[] {
        return Array.from(
            new Set(
                (keywords || [])
                    .map((keyword) => keyword.trim().toLowerCase())
                    .filter((keyword) => keyword.length > 0)
            )
        );
    }

    private normalizeSources(sources?: LeadDiscoverySource[]): LeadSource[] {
        const normalized = Array.from(new Set((sources || []).filter(Boolean)));
        const discoverySources = normalized.length ? normalized : [...DEFAULT_LEAD_DISCOVERY_SOURCES];
        return discoverySources.map((source) => DISCOVERY_SOURCE_TO_LEAD_SOURCE[source]);
    }

    private getMatchedKeywords(lead: Lead, keywords: string[]): string[] {
        if (!keywords.length) {
            return [];
        }

        const haystack = [
            lead.name,
            lead.company,
            lead.notes,
            ...(lead.searchKeywords || []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return keywords.filter((keyword) => haystack.includes(keyword));
    }
}