import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type UpworkApiConfig = {
  mode?: 'public-web' | 'api';
  clientId?: string;
  clientSecret?: string;
  grantType?: 'client_credentials';
  accessToken?: string;
  tenantId?: string;
  graphqlUrl?: string;
  tokenUrl?: string;
  searchQueryDocument?: string;
  searchLimit?: number;
};

export type UpworkApiJob = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  clientCompany?: string;
  budgetSummary?: string;
  category?: string;
  skills: string[];
  experienceLevel?: string;
  engagementType?: string;
  publishedAt?: string;
  raw: Record<string, unknown>;
};

export type UpworkApiSearchResult = {
  jobs: UpworkApiJob[];
  queryText: string;
  warnings: string[];
};

type CachedToken = {
  accessToken: string;
  expiresAt?: number;
};

const DEFAULT_UPWORK_GRAPHQL_URL = 'https://api.upwork.com/graphql';
const DEFAULT_UPWORK_TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

@Injectable()
export class UpworkApiService {
  private readonly logger = new Logger(UpworkApiService.name);
  private cachedToken: CachedToken | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async searchJobs(keywords: string[]): Promise<UpworkApiSearchResult> {
    const config = this.getConfig();
    const queryText = keywords.filter(Boolean).join(' ').trim();
    const warnings: string[] = [];

    if (!queryText) {
      return {
        jobs: [],
        queryText,
        warnings: ['Upwork API search skipped because the topic did not produce any usable search terms.'],
      };
    }

    if (!config.searchQueryDocument?.trim()) {
      return {
        jobs: [],
        queryText,
        warnings: [
          'Upwork API mode is enabled, but no GraphQL search query is configured. Set leadDiscovery.upwork.searchQueryDocument to an approved Upwork job search query that accepts query and limit variables.',
        ],
      };
    }

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to authenticate with the Upwork API.';
      return {
        jobs: [],
        queryText,
        warnings: [message],
      };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          config.graphqlUrl || DEFAULT_UPWORK_GRAPHQL_URL,
          {
            query: config.searchQueryDocument,
            variables: {
              query: queryText,
              limit: Math.max(1, Math.min(config.searchLimit || 10, 25)),
            },
          },
          {
            headers: this.buildGraphqlHeaders(accessToken, config.tenantId),
          }
        )
      );

      const responseBody = response.data as Record<string, unknown> | undefined;
      const errors = Array.isArray(responseBody?.errors) ? responseBody.errors : [];
      if (errors.length) {
        warnings.push(
          ...errors
            .map((entry) => this.readGraphqlError(entry))
            .filter((value): value is string => Boolean(value))
        );
      }

      const jobs = this.normalizeJobs(responseBody?.data as Record<string, unknown> | undefined);
      if (!jobs.length && !warnings.length) {
        warnings.push('Upwork API returned no job results for the generated query.');
      }

      return {
        jobs,
        queryText,
        warnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upwork API request failed.';
      this.logger.warn(`Upwork API request failed for query "${queryText}": ${message}`);
      return {
        jobs: [],
        queryText,
        warnings: [`Upwork API request failed: ${message}`],
      };
    }
  }

  private getConfig(): UpworkApiConfig {
    return this.configService.get<UpworkApiConfig>('leadDiscovery.upwork', {
      infer: true,
    }) || {};
  }

  private async getAccessToken(config: UpworkApiConfig): Promise<string> {
    if (config.accessToken?.trim()) {
      return config.accessToken.trim();
    }

    if (this.cachedToken?.accessToken && this.isCachedTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Upwork API mode requires either an access token or both clientId and clientSecret.');
    }

    const tokenUrl = config.tokenUrl || DEFAULT_UPWORK_TOKEN_URL;
    const grantType = config.grantType || 'client_credentials';
    const body = new URLSearchParams({
      grant_type: grantType,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await firstValueFrom(
      this.httpService.post(tokenUrl, body.toString(), {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
      })
    );

    const tokenResponse = response.data as {
      access_token?: string;
      expires_in?: number | string;
    };
    const accessToken = tokenResponse?.access_token?.trim();
    if (!accessToken) {
      throw new Error('Upwork token exchange did not return an access token.');
    }

    const expiresIn = Number(tokenResponse.expires_in);
    this.cachedToken = {
      accessToken,
      expiresAt: Number.isFinite(expiresIn) ? Date.now() + Math.max(expiresIn - 60, 0) * 1000 : undefined,
    };

    return accessToken;
  }

  private isCachedTokenValid(token: CachedToken): boolean {
    return !token.expiresAt || token.expiresAt > Date.now();
  }

  private buildGraphqlHeaders(accessToken: string, tenantId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };

    if (tenantId?.trim()) {
      headers['X-Upwork-API-TenantId'] = tenantId.trim();
    }

    return headers;
  }

  private readGraphqlError(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message.trim() : null;
  }

  private normalizeJobs(data: Record<string, unknown> | undefined): UpworkApiJob[] {
    const rawNodes = this.collectNodes(data);
    return rawNodes
      .map((node) => this.normalizeJobNode(node))
      .filter((job): job is UpworkApiJob => Boolean(job));
  }

  private collectNodes(data: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
    if (!data) {
      return [];
    }

    const queue: unknown[] = [data];
    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<unknown>();

    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) {
        continue;
      }
      seen.add(current);

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      const record = current as Record<string, unknown>;
      if (this.looksLikeJobNode(record)) {
        results.push(record);
        continue;
      }

      for (const value of Object.values(record)) {
        if (Array.isArray(value)) {
          queue.push(...value);
          continue;
        }

        if (value && typeof value === 'object') {
          const maybeNode = (value as Record<string, unknown>).node;
          if (maybeNode && typeof maybeNode === 'object') {
            queue.push(maybeNode);
          }
          queue.push(value);
        }
      }
    }

    return results;
  }

  private looksLikeJobNode(node: Record<string, unknown>): boolean {
    const title = this.readString(node.title);
    if (!title) {
      return false;
    }

    return Boolean(
      node.description ||
        node.descriptionText ||
        node.ciphertext ||
        node.summary ||
        node.jobUrl ||
        node.url ||
        node.skills ||
        node.skillNames ||
        node.client
    );
  }

  private normalizeJobNode(node: Record<string, unknown>): UpworkApiJob | null {
    const id = this.readString(node.id) || this.readString(node.uid) || this.readString(node.ciphertext);
    const title = this.readString(node.title);
    if (!id || !title) {
      return null;
    }

    const skills = this.readSkills(node.skills) || this.readSkills(node.skillNames) || [];
    const budget =
      this.readBudget(node.budget) ||
      this.readBudget(node.hourlyBudgetMin) ||
      this.readString(node.budgetSummary);
    const client = this.readClientCompany(node.client) || this.readString(node.clientCompany);

    return {
      id,
      title,
      description:
        this.readString(node.description) ||
        this.readString(node.descriptionText) ||
        this.readString(node.summary) ||
        undefined,
      url: this.readString(node.jobUrl) || this.readString(node.url) || undefined,
      clientCompany: client || undefined,
      budgetSummary: budget || undefined,
      category: this.readString(node.category) || this.readNestedString(node.category, 'name') || undefined,
      skills,
      experienceLevel:
        this.readString(node.experienceLevel) ||
        this.readNestedString(node.experienceLevel, 'label') ||
        undefined,
      engagementType:
        this.readString(node.engagementType) ||
        this.readNestedString(node.engagementType, 'label') ||
        undefined,
      publishedAt:
        this.readString(node.publishedAt) ||
        this.readString(node.createdOn) ||
        this.readString(node.createdAt) ||
        undefined,
      raw: node,
    };
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readNestedString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return this.readString((value as Record<string, unknown>)[key]);
  }

  private readSkills(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const skills = value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        return this.readString((entry as Record<string, unknown>).name);
      })
      .filter((entry): entry is string => Boolean(entry));

    return skills.length ? Array.from(new Set(skills)) : null;
  }

  private readBudget(value: unknown): string | null {
    if (typeof value === 'number') {
      return `${value}`;
    }

    if (!value || typeof value !== 'object') {
      return this.readString(value);
    }

    const record = value as Record<string, unknown>;
    const amount = this.readString(record.amount) || (typeof record.amount === 'number' ? `${record.amount}` : null);
    const currency = this.readString(record.currencyCode) || this.readString(record.currency);
    const minimum = this.readString(record.min) || (typeof record.min === 'number' ? `${record.min}` : null);
    const maximum = this.readString(record.max) || (typeof record.max === 'number' ? `${record.max}` : null);

    if (amount) {
      return currency ? `${amount} ${currency}` : amount;
    }

    if (minimum || maximum) {
      const range = [minimum, maximum].filter(Boolean).join(' - ');
      return currency ? `${range} ${currency}`.trim() : range;
    }

    return null;
  }

  private readClientCompany(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return this.readString(value);
    }

    const record = value as Record<string, unknown>;
    return (
      this.readString(record.companyName) ||
      this.readString(record.name) ||
      this.readNestedString(record.company, 'name')
    );
  }
}