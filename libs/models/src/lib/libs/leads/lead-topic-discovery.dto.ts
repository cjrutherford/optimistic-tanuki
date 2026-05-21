import { IsString } from 'class-validator';

export type LeadTopicDiscoveryStatus =
    | 'idle'
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped';

export type LeadTopicDiscoverySeverity =
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

export type LeadTopicProviderStatus =
    | 'ok'
    | 'warning'
    | 'error'
    | 'skipped';

export type LeadTopicDiagnosticIssueType =
    | 'missing-credentials'
    | 'upstream-response'
    | 'provider-failure'
    | 'excluded-results'
    | 'no-results'
    | 'other';

export class RunLeadTopicDiscoveryDto {
    @IsString()
    topicId: string;
}

export class LeadTopicDiscoveryIssueDto {
    type: LeadTopicDiagnosticIssueType;
    severity: LeadTopicDiscoverySeverity;
    summary: string;
    detail: string;
    action?: string;
}

export class LeadTopicDiagnosticCountsDto {
    errors: number;
    warnings: number;
    providersWithIssues: number;
}

export class LeadTopicProviderResultDto {
    providerName: string;
    status?: LeadTopicProviderStatus;
    candidateCount: number;
    queries: string[];
    warnings: string[];
    issues?: LeadTopicDiscoveryIssueDto[];
}

export class LeadTopicDiscoveryResultDto {
    topicId: string;
    linkedLeadCount: number;
    addedCount: number;
    removedCount: number;
    queued: boolean;
    status: LeadTopicDiscoveryStatus;
    skipped?: boolean;
    lastRun?: string;
    message?: string;
    severity?: LeadTopicDiscoverySeverity;
    summaryTitle?: string;
    summaryBody?: string;
    actionItems?: string[];
    diagnosticCounts?: LeadTopicDiagnosticCountsDto;
    providerResults?: LeadTopicProviderResultDto[];
}
