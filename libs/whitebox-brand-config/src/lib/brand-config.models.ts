/**
 * Shared brand configuration models for white-box applications.
 * Enables client brand tailoring, multi-tenant cloud hosting, and on-premises standalone deployments.
 */

export type WhiteboxVertical =
  | 'trade_field'
  | 'cpa_tax'
  | 'legal_title'
  | 'builders_municipal';

export type WhiteboxHardwareTier =
  | 'tier1_mini'
  | 'tier2_tower'
  | 'tier3_rackmount';

export interface WhiteboxServiceOffering {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  durationHours: number;
  features: string[];
}

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
  hardwareTier: WhiteboxHardwareTier;
  applianceName: string;
  services: WhiteboxServiceOffering[];
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
    hardwareTier: 'tier1_mini',
    applianceName: 'Tier 1 Compact Mini-PC (Beelink N100)',
    services: [
      {
        id: 'standard',
        name: 'Standard Detailing Wash',
        description:
          'Comprehensive hand wash, wheels, windows, and interior vacuum.',
        basePrice: 120,
        durationHours: 2,
        features: [
          'Hand foam wash and bug removal',
          'Wheel face and tire dressing',
          'Streak-free exterior and interior glass',
          'Interior vacuum and dashboard wipe-down',
        ],
      },
      {
        id: 'premium',
        name: 'Ceramic Sealant & Interior Steam',
        description:
          'Clay bar decontamination, hydrophobic sealant, and hot steam interior disinfection.',
        basePrice: 220,
        durationHours: 3.5,
        features: [
          'All Standard Detailing Wash features',
          'Clay bar surface decontamination',
          'Six-month polymer ceramic sealant application',
          'Steam cleaning of door cards, vents, and consoles',
        ],
      },
      {
        id: 'restoration',
        name: 'Full Paint Correction & 1-Year Coating',
        description:
          'Multi-stage machine paint polish eliminating swirl marks and 1-year ceramic bond.',
        basePrice: 360,
        durationHours: 5,
        features: [
          'All Ceramic Sealant features',
          'Multi-stage machine cut and polish',
          'Deep hot-water carpet and seat extraction',
          'One-year premium ceramic glass and body shield',
        ],
      },
    ],
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
    hardwareTier: 'tier1_mini',
    applianceName: 'Tier 1 Compact Mini-PC (Beelink N100)',
    services: [
      {
        id: 'standard',
        name: 'Flatwork Surface Cleaning',
        description:
          'High-pressure surface rotary wash for driveways, walkways, and patios.',
        basePrice: 150,
        durationHours: 2,
        features: [
          'Rotary surface cleaner on flat concrete',
          'Post-treatment mildew inhibitor',
          'Edge cleanup and perimeter rinse',
          'Organic stain lift treatment',
        ],
      },
      {
        id: 'premium',
        name: 'Whole-Home Low-Pressure Soft Wash',
        description:
          'Gentle siding soft wash, gutter face brightening, and exterior glass rinse.',
        basePrice: 280,
        durationHours: 3.5,
        features: [
          'Low-pressure detergent application for vinyl and stucco',
          'Gutter exterior face brightening',
          'Plant and landscape hydration protection',
          'Window exterior spot-free rinse',
        ],
      },
      {
        id: 'restoration',
        name: 'Full Commercial Concrete & Roof Restoration',
        description:
          'Heavy oil stain degreasing, roof algae neutralization, and comprehensive perimeter wash.',
        basePrice: 520,
        durationHours: 6,
        features: [
          'All Whole-Home Soft Wash features',
          'Hot-water commercial oil and grease extraction',
          'Roof gloeocapsa magma algae soft treatment',
          'Dumpster pad and loading dock sanitation',
        ],
      },
    ],
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
    hardwareTier: 'tier1_mini',
    applianceName: 'Tier 1 Compact Mini-PC (Beelink N100)',
    services: [
      {
        id: 'standard',
        name: 'Diagnostic Inspection & Breaker Audit',
        description:
          'Comprehensive electrical safety inspection, panel thermal scan, and GFCI tests.',
        basePrice: 140,
        durationHours: 1.5,
        features: [
          'Breaker panel thermal infrared scan',
          'GFCI and AFCI receptacle verification',
          'Grounding electrode resistance check',
          'Safety checklist and violation report',
        ],
      },
      {
        id: 'premium',
        name: 'EV Charger & 240V Dedicated Circuit',
        description:
          'Level 2 EV charger installation or dedicated 50-amp appliance circuit.',
        basePrice: 390,
        durationHours: 4,
        features: [
          '50-amp dedicated conduit run up to 30 feet',
          'NEMA 14-50 receptacle or hardwired wall connector',
          'Load calculation and circuit breaker sizing',
          'Municipal permit package preparation',
        ],
      },
      {
        id: 'restoration',
        name: 'Whole-Home 200A Panel Replacement',
        description:
          'Complete service entrance upgrade to 200 amps with whole-house surge suppression.',
        basePrice: 1450,
        durationHours: 8,
        features: [
          '200-amp main breaker panel and meter base',
          'Type 2 whole-house surge protection device',
          'Dual copper ground rod system',
          'Utility coordination and final inspection sign-off',
        ],
      },
    ],
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
    hardwareTier: 'tier1_mini',
    applianceName: 'Tier 1 Compact Mini-PC (Beelink N100)',
    services: [
      {
        id: 'standard',
        name: 'Drone Roof Inspection & Leak Audit',
        description:
          'High-resolution aerial drone survey and attic moisture assessment.',
        basePrice: 180,
        durationHours: 2,
        features: [
          '4K aerial drone shingle inspection',
          'Chimney and plumbing vent pipe boot check',
          'Attic decking moisture scan',
          'Detailed photographic storm damage report',
        ],
      },
      {
        id: 'premium',
        name: 'Gutter Guard System & Valley Flashing',
        description:
          'Micro-mesh stainless steel gutter guards and roof valley flashing resealing.',
        basePrice: 450,
        durationHours: 4,
        features: [
          'Full gutter system cleaning and slope verification',
          'Surgical-grade stainless micro-mesh installation',
          'Valley flashing and sidewall sealant renewal',
          'Downspout diverter optimization',
        ],
      },
      {
        id: 'restoration',
        name: 'Architectural Shingle Storm Restoration',
        description:
          'Complete tear-off, synthetic underlayment, and Class 4 architectural shingle installation.',
        basePrice: 2800,
        durationHours: 12,
        features: [
          'Complete tear-off down to wood decking',
          'Ice and water shield in all valleys and eaves',
          'Class 4 impact-resistant architectural shingles',
          'Ridge vent continuous attic ventilation system',
        ],
      },
    ],
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
    hardwareTier: 'tier2_tower',
    applianceName: 'Tier 2 Workstation Tower (Dell T150)',
    services: [
      {
        id: 'tax-prep',
        name: 'Individual & Small Business Tax Return',
        description:
          'Comprehensive tax filing with W-2, 1099, and Schedule C reconciliation.',
        basePrice: 350,
        durationHours: 3,
        features: [
          'IRS e-file',
          'Schedule C analysis',
          'Prior year comparison',
        ],
      },
      {
        id: 'corp-advisory',
        name: 'Corporate Compliance & Quarterly Estimates',
        description:
          'Entity tax filings (1120-S, 1065) and quarterly payroll tax planning.',
        basePrice: 850,
        durationHours: 6,
        features: [
          'Quarterly estimated calculations',
          'Depreciation schedules',
          'K-1 distribution prep',
        ],
      },
    ],
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
    hardwareTier: 'tier2_tower',
    applianceName: 'Tier 2 Workstation Tower (Dell T150)',
    services: [
      {
        id: 'closing-escrow',
        name: 'Residential Closing & Escrow Settlement',
        description:
          'Secure wire verification, title search, and closing document execution.',
        basePrice: 750,
        durationHours: 4,
        features: [
          'Wire verification handshake',
          'Deed recording',
          'Title insurance binding',
        ],
      },
      {
        id: 'commercial-closing',
        name: 'Commercial Settlement & Due Diligence',
        description:
          'Commercial real estate acquisition escrow and multi-parcel title clearance.',
        basePrice: 1850,
        durationHours: 8,
        features: [
          'ALTA survey review',
          'Zoning verification',
          'Lender doc coordination',
        ],
      },
    ],
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
    hardwareTier: 'tier3_rackmount',
    applianceName: 'Tier 3 Enterprise 2U Rackmount (Supermicro EPYC)',
    services: [
      {
        id: 'site-plan-review',
        name: 'Site Plan Feasibility & Code Review',
        description:
          'Comprehensive zoning, civil engineering, and municipal permit packet review.',
        basePrice: 1200,
        durationHours: 8,
        features: [
          'Zoning compliance check',
          'Utility access review',
          'Permit application drafting',
        ],
      },
      {
        id: 'project-management',
        name: 'Commercial Build Subcontractor Coordination',
        description:
          'On-site construction oversight, progress draw inspections, and safety compliance.',
        basePrice: 3200,
        durationHours: 20,
        features: [
          'Subcontractor scheduling',
          'OSHA compliance audit',
          'Draw inspection report',
        ],
      },
    ],
  },
];

export const DEMO_BRAND_PROFILES: WhiteboxBrandProfile[] =
  SHARED_WHITEBOX_PROFILES.filter((p) => p.vertical === 'trade_field');
