/**
 * Shared brand configuration models for white-box applications.
 * Enables client brand tailoring, multi-tenant cloud hosting, and on-premises standalone deployments.
 */

export type WhiteboxVertical =
  | 'trade_field'
  | 'cpa_tax'
  | 'legal_title'
  | 'builders_municipal';

export interface WhiteboxBrandProfile {
  id: string;
  businessName: string;
  tradeCategory: string;
  vertical: WhiteboxVertical;
  phone: string;
  email: string;
  serviceArea: string;
  fixedDeposit: number;
  taxRate: number;
  googleReviewUrl: string;
  isDemoMode: boolean;
  isStandalone: boolean;
  themePreset?: string;
}

export type BrandProfile = WhiteboxBrandProfile;

export const SHARED_WHITEBOX_PROFILES: WhiteboxBrandProfile[] = [
  // Vertical 1: Trade and Field Services (Field Flow)
  {
    id: 'apex-detailing',
    businessName: 'Apex Mobile Detailing',
    tradeCategory: 'Mobile Auto & Fleet Detailing',
    vertical: 'trade_field',
    phone: '(912) 555-0144',
    email: 'service@apexdetailing-sav.com',
    serviceArea: 'Savannah, Pooler, and Richmond Hill',
    fixedDeposit: 50,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/apex-detailing/review',
    isDemoMode: true,
    isStandalone: false,
    themePreset: 'tradecraft',
  },
  {
    id: 'coastal-pressure-wash',
    businessName: 'Coastal Pressure Washing',
    tradeCategory: 'Commercial & Residential Surface Washing',
    vertical: 'trade_field',
    phone: '(912) 555-0182',
    email: 'dispatch@coastalwash-ga.com',
    serviceArea: 'Chatham and Bryan Counties',
    fixedDeposit: 75,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/coastal-wash/review',
    isDemoMode: true,
    isStandalone: false,
    themePreset: 'tradecraft',
  },
  {
    id: 'wirepro-electrical',
    businessName: 'WirePro Electrical Services',
    tradeCategory: 'Licensed Electrical Contracting',
    vertical: 'trade_field',
    phone: '(912) 555-0199',
    email: 'contact@wirepro-electric.com',
    serviceArea: 'Greater Savannah Metro Area',
    fixedDeposit: 100,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/wirepro-electric/review',
    isDemoMode: true,
    isStandalone: false,
    themePreset: 'tradecraft',
  },
  {
    id: 'summit-roofing',
    businessName: 'Summit Roofing & Exterior Restoration',
    tradeCategory: 'Roofing & Storm Restoration',
    vertical: 'trade_field',
    phone: '(912) 555-0177',
    email: 'quotes@summitroofing-ga.com',
    serviceArea: 'Coastal Georgia',
    fixedDeposit: 150,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/summit-roofing/review',
    isDemoMode: true,
    isStandalone: false,
    themePreset: 'tradecraft',
  },

  // Vertical 2: CPA and Tax Practices (Practice Vault)
  {
    id: 'savannah-tax-vault',
    businessName: 'Savannah Certified Tax Advisors',
    tradeCategory: 'Regulated CPA & Advisory',
    vertical: 'cpa_tax',
    phone: '(912) 555-0210',
    email: 'intake@savannahtax-vault.com',
    serviceArea: 'Southeast Georgia Region',
    fixedDeposit: 250,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/savannah-tax/review',
    isDemoMode: true,
    isStandalone: false,
  },

  // Vertical 3: Real Estate Title and Law Firms (Wire Shield)
  {
    id: 'coastal-title-shield',
    businessName: 'Coastal Title & Escrow Group',
    tradeCategory: 'Title Settlement & Real Estate Law',
    vertical: 'legal_title',
    phone: '(912) 555-0320',
    email: 'closings@coastaltitle-shield.com',
    serviceArea: 'Chatham, Effingham, and Liberty Counties',
    fixedDeposit: 500,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/coastal-title/review',
    isDemoMode: true,
    isStandalone: false,
  },

  // Vertical 4: Commercial Builders and Municipal Agencies (Project Nexus & Civic Core)
  {
    id: 'chatham-builders-nexus',
    businessName: 'Chatham Commercial Builders',
    tradeCategory: 'Commercial Construction & Department Review',
    vertical: 'builders_municipal',
    phone: '(912) 555-0450',
    email: 'plans@chatham-nexus.com',
    serviceArea: 'South Georgia Regional District',
    fixedDeposit: 1000,
    taxRate: 0.07,
    googleReviewUrl: 'https://g.page/r/chatham-builders/review',
    isDemoMode: true,
    isStandalone: false,
  },
];

export const DEMO_BRAND_PROFILES: WhiteboxBrandProfile[] =
  SHARED_WHITEBOX_PROFILES.filter((p) => p.vertical === 'trade_field');
