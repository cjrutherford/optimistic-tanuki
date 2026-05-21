import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { InternalDiscoveryProvider } from './internal-discovery.provider';

describe('InternalDiscoveryProvider', () => {
    it('scopes internal discovery queries by profile and app scope', async () => {
        const leadRepository = {
            find: jest.fn().mockResolvedValue([
                {
                    id: 'lead-1',
                    name: 'React modernization consulting',
                    company: 'Acme',
                    notes: 'Strong React migration need',
                    searchKeywords: ['react modernization'],
                    source: LeadSource.REMOTE_OK,
                },
                {
                    id: 'lead-2',
                    name: 'Unrelated finance role',
                    company: 'Globex',
                    notes: 'No frontend work',
                    searchKeywords: ['accounting'],
                    source: LeadSource.REMOTE_OK,
                },
            ]),
        };
        const provider = new InternalDiscoveryProvider(leadRepository as any);
        const topic = {
            id: 'topic-1',
            name: 'React modernization',
            description: 'Find React modernization leads',
            keywords: ['react modernization'],
            excludedTerms: [],
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
            appScope: 'leads-app',
            profileId: 'profile-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as LeadTopic;

        const result = await provider.search(topic);

        expect(leadRepository.find).toHaveBeenCalledWith({
            where: {
                profileId: 'profile-1',
                appScope: 'leads-app',
            },
        });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0]).toEqual(
            expect.objectContaining({
                providerName: 'internal',
                matchedKeywords: ['react modernization'],
            })
        );
    });

    it('returns a warning when scoped leads do not match the topic', async () => {
        const leadRepository = {
            find: jest.fn().mockResolvedValue([
                {
                    id: 'lead-3',
                    name: 'Accounting systems migration',
                    company: 'Initrode',
                    notes: 'ERP implementation support',
                    searchKeywords: ['erp'],
                    source: LeadSource.REMOTE_OK,
                },
            ]),
        };
        const provider = new InternalDiscoveryProvider(leadRepository as any);

        const result = await provider.search({
            id: 'topic-2',
            name: 'React modernization',
            description: 'Find React modernization leads',
            keywords: ['react modernization'],
            excludedTerms: [],
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
            appScope: 'leads-app',
            profileId: 'profile-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as LeadTopic);

        expect(result.candidates).toEqual([]);
        expect(result.warnings).toEqual(['No existing leads matched this topic.']);
    });
});
