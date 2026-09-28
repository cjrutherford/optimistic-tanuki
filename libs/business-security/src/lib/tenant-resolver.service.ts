import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DEFAULT_TENANT_RULES,
  TenantContext,
  TenantResolutionRequest,
  TenantResolverOptions,
  TenantRoutingRule,
} from './tenant-resolution.types';
import { ITenantCache, MemoryTenantCache } from './tenant-cache';

export const TENANT_HEADER_FALLBACK_CONFIG = 'TENANT_HEADER_FALLBACK_CONFIG';
export const DEFAULT_TENANT_HEADER_FALLBACK_CONFIG: TenantResolverOptions = {
  allowHeaderFallback: false,
};

@Injectable()
export class TenantResolverService {
  private readonly rules = new Map<string, TenantRoutingRule>();
  private readonly cache: ITenantCache;
  private readonly allowHeaderFallback: boolean;

  constructor(
    @Optional() customRules?: TenantRoutingRule[],
    @Optional() cacheProvider?: ITenantCache,
    @Optional()
    @Inject(TENANT_HEADER_FALLBACK_CONFIG)
    resolverOptions?: TenantResolverOptions
  ) {
    this.cache = cacheProvider ?? new MemoryTenantCache();
    this.allowHeaderFallback = resolverOptions?.allowHeaderFallback === true;
    const initialRules =
      customRules === undefined ? DEFAULT_TENANT_RULES : customRules;
    for (const rule of initialRules) {
      this.registerRule(rule);
    }
  }

  registerRule(rule: TenantRoutingRule): void {
    this.rules.set(rule.tenantId, {
      ...rule,
      active: rule.active !== false,
      hostPatterns: rule.hostPatterns.map((host) => this.normalizeHost(host)),
      cnameDomains: rule.cnameDomains.map((domain) =>
        this.normalizeHost(domain)
      ),
    });
  }

  getRule(tenantId: string): TenantRoutingRule | undefined {
    return this.rules.get(tenantId);
  }

  getAllRules(): TenantRoutingRule[] {
    return Array.from(this.rules.values());
  }

  async resolve(req: TenantResolutionRequest): Promise<TenantContext | null> {
    const host =
      typeof req.host === 'string' ? this.normalizeHost(req.host) : '';
    if (host) {
      const hostContext = await this.resolveHost(host);
      if (hostContext) {
        return hostContext;
      }
    }

    if (!this.allowHeaderFallback) {
      return null;
    }

    const explicitId =
      typeof req.xTenantId === 'string' ? req.xTenantId.trim() : '';
    if (!explicitId) {
      return null;
    }

    const rule = this.rules.get(explicitId);
    if (!rule || rule.active === false) {
      return null;
    }

    return {
      tenantId: rule.tenantId,
      matchedBy: 'header',
      matchedValue: explicitId,
      tenant: rule,
    };
  }

  private async resolveHost(host: string): Promise<TenantContext | null> {
    const cacheKey = `host:${host}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const currentMatch = this.findHostMatch(host);
      if (
        currentMatch &&
        cached.tenantId === currentMatch.rule.tenantId &&
        cached.matchedBy === currentMatch.matchedBy &&
        cached.matchedValue === host
      ) {
        return {
          ...cached,
          tenant: currentMatch.rule,
        };
      }
      await this.cache.delete(cacheKey);
    }

    const match = this.findHostMatch(host);
    if (!match) {
      return null;
    }

    const result: TenantContext = {
      tenantId: match.rule.tenantId,
      matchedBy: match.matchedBy,
      matchedValue: host,
      tenant: match.rule,
    };
    await this.cache.set(cacheKey, result);
    return result;
  }

  async invalidate(hostOrTenantId: string): Promise<void> {
    const normalized = this.normalizeHost(hostOrTenantId);
    await this.cache.delete(`host:${normalized}`);
  }

  private findHostMatch(
    host: string
  ): { rule: TenantRoutingRule; matchedBy: 'cname' | 'host' } | null {
    const matches: Array<{
      rule: TenantRoutingRule;
      matchedBy: 'cname' | 'host';
      priority: number;
    }> = [];

    for (const rule of this.rules.values()) {
      if (rule.active === false) continue;

      for (const domain of rule.cnameDomains) {
        const priority = this.getMatchPriority(host, domain, 'cname');
        if (priority !== null) {
          matches.push({ rule, matchedBy: 'cname', priority });
        }
      }

      for (const pattern of rule.hostPatterns) {
        const priority = this.getMatchPriority(host, pattern, 'host');
        if (priority !== null) {
          matches.push({ rule, matchedBy: 'host', priority });
        }
      }
    }

    matches.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (left.rule.tenantId === right.rule.tenantId) {
        return 0;
      }
      return left.rule.tenantId < right.rule.tenantId ? -1 : 1;
    });

    const selected = matches[0];
    return selected
      ? { rule: selected.rule, matchedBy: selected.matchedBy }
      : null;
  }

  private getMatchPriority(
    incomingHost: string,
    target: string,
    kind: 'cname' | 'host'
  ): number | null {
    if (incomingHost === target) {
      return kind === 'cname' ? 0 : 1;
    }
    if (target.startsWith('*.') && this.domainMatches(incomingHost, target)) {
      return kind === 'cname' ? 2 : 3;
    }
    return null;
  }

  private normalizeHost(rawHost: string): string {
    let normalized = rawHost.trim().toLowerCase();
    if (!normalized) {
      return '';
    }

    if (normalized.startsWith('[')) {
      const closingBracket = normalized.indexOf(']');
      if (closingBracket > 0) {
        normalized = normalized.slice(0, closingBracket + 1);
      }
    } else {
      const portSeparator = normalized.lastIndexOf(':');
      if (
        portSeparator > 0 &&
        /^\d+$/.test(normalized.slice(portSeparator + 1))
      ) {
        normalized = normalized.slice(0, portSeparator);
      }
    }

    while (normalized.endsWith('.')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  private domainMatches(
    incomingHost: string,
    targetDomainOrPattern: string
  ): boolean {
    if (incomingHost === targetDomainOrPattern) {
      return true;
    }

    if (targetDomainOrPattern.startsWith('*.')) {
      const suffix = targetDomainOrPattern.slice(2);
      return incomingHost.endsWith(`.${suffix}`) || incomingHost === suffix;
    }

    return false;
  }
}
