import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PageAnalysis, SearchResult, SearchResultType } from './discovery.types';

type SearchConfig = {
  enabled: boolean;
  provider: string;
  requestTimeoutMs: number;
  userAgent: string;
  maxResultsPerQuery: number;
  maxQueriesPerProvider: number;
  googleApiKey?: string;
  googleCx?: string;
  locale: string;
};

@Injectable()
export class SearchAcquisitionService {
  private readonly logger = new Logger(SearchAcquisitionService.name);
  private readonly pageAnalysisCache = new Map<string, PageAnalysis | null>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  getMaxQueriesPerProvider(): number {
    return this.getConfig().maxQueriesPerProvider || 6;
  }

  isSearchEnabled(): boolean {
    return this.getConfig().enabled;
  }

  getSearchWarning(): string | null {
    const config = this.getConfig();

    if (!config.enabled) {
      return 'Search acquisition is disabled by configuration.';
    }

    if (config.provider === 'google-html') {
      return 'Search acquisition is using Google HTML parsing, which is best-effort and may return no usable results.';
    }

    if (config.provider === 'google-cse' && (!config.googleApiKey || !config.googleCx)) {
      return 'Google CSE search is selected but API credentials are incomplete.';
    }

    return null;
  }

  async searchWeb(query: string, maxResults?: number): Promise<SearchResult[]> {
    const config = this.getConfig();
    if (!config.enabled) {
      return [];
    }

    if (config.provider === 'google-cse' && config.googleApiKey && config.googleCx) {
      return this.searchGoogleCse(query, maxResults || config.maxResultsPerQuery);
    }

    const results = await this.searchGoogleHtml(
      query,
      maxResults || config.maxResultsPerQuery
    );
    if (results.length) {
      return results;
    }

    return this.searchDuckDuckGoHtml(
      query,
      maxResults || config.maxResultsPerQuery
    );
  }

  async searchNews(query: string, maxResults?: number): Promise<SearchResult[]> {
    const config = this.getConfig();
    if (!config.enabled) {
      return [];
    }

    const locale = config.locale || 'en-US';
    const [language, region = 'US'] = locale.split('-');
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}-${region}&gl=${region}&ceid=${region}:${language}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'text',
          timeout: config.requestTimeoutMs,
          headers: this.getHeaders(config),
        })
      );

      return this.parseRssItems(this.readTextBody(response.data), query, 'news').slice(
        0,
        maxResults || config.maxResultsPerQuery
      );
    } catch (error) {
      this.logger.warn(`News search failed for query "${query}"`);
      return [];
    }
  }

  async analyzePage(url: string): Promise<PageAnalysis | null> {
    if (this.pageAnalysisCache.has(url)) {
      return this.pageAnalysisCache.get(url) || null;
    }

    const config = this.getConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'text',
          timeout: config.requestTimeoutMs,
          headers: this.getHeaders(config),
        })
      );

      const html = this.readTextBody(response.data);
      const analysis: PageAnalysis = {
        url,
        title: this.extractHtmlTitle(html),
        description: this.extractMetaDescription(html),
        text: this.normalizePageText(html),
      };

      this.pageAnalysisCache.set(url, analysis);
      return analysis;
    } catch (error) {
      this.logger.warn(`Page analysis failed for url "${url}"`);
      this.pageAnalysisCache.set(url, null);
      return null;
    }
  }

  private getConfig(): SearchConfig {
    return this.configService.get<SearchConfig>('leadDiscovery.search', { infer: true }) || {
      enabled: true,
      provider: 'google-html',
      requestTimeoutMs: 5000,
      userAgent: 'OptimisticTanukiLeadDiscovery/1.0',
      maxResultsPerQuery: 8,
      maxQueriesPerProvider: 6,
      locale: 'en-US',
    };
  }

  private async searchGoogleCse(query: string, maxResults: number): Promise<SearchResult[]> {
    const config = this.getConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/customsearch/v1', {
          params: {
            key: config.googleApiKey,
            cx: config.googleCx,
            q: query,
            num: Math.min(maxResults, 10),
            hl: config.locale,
          },
          timeout: config.requestTimeoutMs,
          headers: this.getHeaders(config),
        })
      );

      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      return items.map((item: any, index: number) => ({
        title: item.title || item.link,
        url: item.link,
        snippet: item.snippet || '',
        query,
        resultType: 'web' as SearchResultType,
        rank: index + 1,
      }));
    } catch (error) {
      this.logger.warn(`Google CSE search failed for query "${query}"`);
      return [];
    }
  }

  private async searchGoogleHtml(query: string, maxResults: number): Promise<SearchResult[]> {
    const config = this.getConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.google.com/search', {
          params: {
            q: query,
            num: maxResults,
            hl: config.locale,
          },
          responseType: 'text',
          timeout: config.requestTimeoutMs,
          headers: this.getHeaders(config),
        })
      );

      return this.parseGoogleHtmlResults(this.readTextBody(response.data), query).slice(0, maxResults);
    } catch (error) {
      this.logger.warn(`Google HTML search failed for query "${query}"`);
      return [];
    }
  }

  private async searchDuckDuckGoHtml(
    query: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    const config = this.getConfig();

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://html.duckduckgo.com/html/', {
          params: {
            q: query,
          },
          responseType: 'text',
          timeout: config.requestTimeoutMs,
          headers: this.getHeaders(config),
        })
      );

      return this.parseDuckDuckGoHtmlResults(
        this.readTextBody(response.data),
        query
      ).slice(0, maxResults);
    } catch (error) {
      this.logger.warn(`DuckDuckGo HTML search failed for query "${query}"`);
      return [];
    }
  }

  private parseGoogleHtmlResults(html: string, query: string): SearchResult[] {
    const matches = Array.from(
      html.matchAll(/<a[^>]+href="\/url\?q=([^"&]+)[^>]*>([\s\S]*?)<\/a>/gi)
    );
    const results: SearchResult[] = [];
    const seenUrls = new Set<string>();

    matches.forEach((match, index) => {
      const rawUrl = decodeURIComponent(match[1] || '');
      if (!rawUrl || rawUrl.includes('google.com') || seenUrls.has(rawUrl)) {
        return;
      }

      seenUrls.add(rawUrl);
      const title = this.stripTags(this.decodeHtml(match[2] || '')).trim();
      if (!title) {
        return;
      }

      results.push({
        title,
        url: rawUrl,
        snippet: '',
        query,
        resultType: 'web',
        rank: index + 1,
      });
    });

    return results;
  }

  private parseDuckDuckGoHtmlResults(
    html: string,
    query: string
  ): SearchResult[] {
    const matches = Array.from(
      html.matchAll(
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      )
    );
    const results: SearchResult[] = [];
    const seenUrls = new Set<string>();

    matches.forEach((match, index) => {
      const rawUrl = this.extractDuckDuckGoTargetUrl(match[1] || '');
      if (!rawUrl || seenUrls.has(rawUrl)) {
        return;
      }

      seenUrls.add(rawUrl);
      const title = this.stripTags(this.decodeHtml(match[2] || '')).trim();
      if (!title) {
        return;
      }

      results.push({
        title,
        url: rawUrl,
        snippet: '',
        query,
        resultType: 'web',
        rank: index + 1,
      });
    });

    return results;
  }

  private extractDuckDuckGoTargetUrl(value: string): string {
    try {
      const url = new URL(value, 'https://duckduckgo.com');
      const uddg = url.searchParams.get('uddg');
      return uddg ? decodeURIComponent(uddg) : url.toString();
    } catch {
      return value;
    }
  }

  private parseRssItems(xml: string, query: string, resultType: SearchResultType): SearchResult[] {
    return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match, index) => {
      const item = match[0];
      return {
        title: this.extractTagValue(item, 'title'),
        url: this.extractTagValue(item, 'link'),
        snippet: this.extractTagValue(item, 'description'),
        query,
        resultType,
        rank: index + 1,
      };
    });
  }

  private extractTagValue(content: string, tag: string): string {
    const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
    return this.stripTags(this.decodeHtml(this.stripCdata(match?.[1] || ''))).trim();
  }

  private extractHtmlTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return this.stripTags(this.decodeHtml(titleMatch?.[1] || '')).trim();
  }

  private extractMetaDescription(html: string): string {
    const metaMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
    return this.stripTags(this.decodeHtml(metaMatch?.[1] || '')).trim();
  }

  private normalizePageText(html: string): string {
    return this.decodeHtml(
      html
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripCdata(value: string): string {
    return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  }

  private stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ');
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  private readTextBody(body: unknown): string {
    return typeof body === 'string' ? body : JSON.stringify(body);
  }

  private getHeaders(config: SearchConfig): Record<string, string> {
    return {
      'user-agent': config.userAgent,
      accept: 'application/json, application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
    };
  }
}
