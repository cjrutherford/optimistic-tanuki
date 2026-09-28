/**
 * Multi-tenant resolution types and contracts.
 */

export type TenantResolutionMethod = 'host' | 'cname' | 'header';

export interface TenantRoutingRule {
  tenantId: string;
  name: string;
  hostPatterns: string[];
  cnameDomains: string[];
  metadata?: Record<string, any>;
  active?: boolean;
}

export interface TenantContext {
  tenantId: string;
  matchedBy: TenantResolutionMethod;
  matchedValue: string;
  tenant: TenantRoutingRule;
}

export interface TenantResolutionRequest {
  host?: string;
  xTenantId?: string;
}

export interface TenantResolverOptions {
  rules?: TenantRoutingRule[];
  cacheTtlMs?: number;
  allowHeaderFallback?: boolean;
}

export const DEFAULT_TENANT_RULES: TenantRoutingRule[] = [
  {
    tenantId: 'apex-detailing',
    name: 'Apex Mobile Detailing',
    hostPatterns: [
      'apex-detailing.hopefulaspirationsindustries.com',
      'apex.hopefulaspirationsindustries.com',
      'apex-detailing.local',
    ],
    cnameDomains: [
      'portal.apexdetailing-sav.com',
      'book.apexdetailing-sav.com',
    ],
    metadata: {
      vertical: 'trade_field',
      tradeCategory: 'Mobile Auto & Fleet Detailing',
      themePreset: 'tradecraft',
    },
    active: true,
  },
  {
    tenantId: 'coastal-pressure-wash',
    name: 'Coastal Pressure Washing',
    hostPatterns: [
      'coastal-pressure-wash.hopefulaspirationsindustries.com',
      'coastal.hopefulaspirationsindustries.com',
      'coastal-pressure-wash.local',
    ],
    cnameDomains: ['portal.coastalwash-ga.com', 'book.coastalwash-ga.com'],
    metadata: {
      vertical: 'trade_field',
      tradeCategory: 'Commercial & Residential Surface Washing',
      themePreset: 'tradecraft',
    },
    active: true,
  },
  {
    tenantId: 'wirepro-electrical',
    name: 'WirePro Electrical Services',
    hostPatterns: [
      'wirepro-electrical.hopefulaspirationsindustries.com',
      'wirepro.hopefulaspirationsindustries.com',
      'wirepro-electrical.local',
    ],
    cnameDomains: ['portal.wireproelectric.com', 'book.wirepro-electric.com'],
    metadata: {
      vertical: 'trade_field',
      tradeCategory: 'Licensed Electrical Contracting',
      themePreset: 'tradecraft',
    },
    active: true,
  },
  {
    tenantId: 'summit-roofing',
    name: 'Summit Roofing & Exterior Restoration',
    hostPatterns: [
      'summit-roofing.hopefulaspirationsindustries.com',
      'summit.hopefulaspirationsindustries.com',
      'summit-roofing.local',
    ],
    cnameDomains: ['portal.summitroofing-ga.com', 'book.summitroofing-ga.com'],
    metadata: {
      vertical: 'trade_field',
      tradeCategory: 'Roofing & Storm Restoration',
      themePreset: 'tradecraft',
    },
    active: true,
  },
  {
    tenantId: 'savannah-tax-vault',
    name: 'Savannah Certified Tax Advisors',
    hostPatterns: [
      'savannah-tax-vault.hopefulaspirationsindustries.com',
      'tax.hopefulaspirationsindustries.com',
    ],
    cnameDomains: ['portal.savannahtax-vault.com'],
    metadata: {
      vertical: 'cpa_tax',
      tradeCategory: 'Regulated CPA & Advisory',
    },
    active: true,
  },
  {
    tenantId: 'coastal-title-shield',
    name: 'Coastal Title & Escrow Group',
    hostPatterns: [
      'coastal-title-shield.hopefulaspirationsindustries.com',
      'title.hopefulaspirationsindustries.com',
    ],
    cnameDomains: ['portal.coastaltitle-shield.com'],
    metadata: {
      vertical: 'legal_title',
      tradeCategory: 'Title Settlement & Real Estate Law',
    },
    active: true,
  },
  {
    tenantId: 'chatham-builders-nexus',
    name: 'Chatham Commercial Builders',
    hostPatterns: [
      'chatham-builders-nexus.hopefulaspirationsindustries.com',
      'builders.hopefulaspirationsindustries.com',
    ],
    cnameDomains: ['portal.chatham-nexus.com'],
    metadata: {
      vertical: 'builders_municipal',
      tradeCategory: 'Commercial Construction & Department Review',
    },
    active: true,
  },
];
