export type OfferingKind = 'preset-app' | 'service' | 'custom-app';
export type CampaignIntent = 'awareness' | 'conversion' | 'launch';
export type ChannelType = 'web' | 'email' | 'social';
export type ToneStyle = 'editorial' | 'direct' | 'technical' | 'warm';
export type GenerationMode = 'template' | 'hybrid';
export type ChannelOutputType =
  | 'landing-page'
  | 'email-sequence'
  | 'social-campaign';
export type MarketingMaterialType =
  | 'flyer'
  | 'brochure'
  | 'business-card'
  | 'web-ad';
export type MaterialSurfaceType =
  | 'front'
  | 'back'
  | 'inside-left'
  | 'inside-right'
  | 'single';
export type ImageRenderStatus = 'idle' | 'queued' | 'complete' | 'failed';

export interface OfferingPreset {
  id: string;
  kind: Exclude<OfferingKind, 'custom-app'>;
  name: string;
  category: string;
  summary: string;
  differentiators: string[];
  features: string[];
  audienceHint: string;
}

export interface AudiencePersona {
  id: string;
  label: string;
  profile: string;
  desiredOutcome: string;
}

export interface CustomAppBrief {
  name: string;
  category: string;
  summary: string;
  features: string;
  differentiators: string;
  primaryGoal: string;
}

export interface MaterialDeliverableRequest {
  type: MarketingMaterialType;
  formatId: string;
  quantity: number;
}

export interface BrandProfile {
  businessName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  visualStyle: string;
  logoUrl: string;
}

export interface GenerationRequest {
  offeringKind: OfferingKind;
  selectedOfferingId: string | null;
  customApp: CustomAppBrief;
  audienceId: string;
  campaignIntent: CampaignIntent;
  channel: ChannelType;
  tone: ToneStyle;
  includeAiPolish: boolean;
  deliverables: MaterialDeliverableRequest[];
  brand: BrandProfile;
  visualDirection: string;
  generateImages: boolean;
}

export interface CampaignSection {
  title: string;
  body: string;
}

export interface ChannelOutputBlock {
  id: string;
  role:
    | 'hero'
    | 'supporting'
    | 'proof'
    | 'cta'
    | 'subject'
    | 'preview'
    | 'caption'
    | 'hook';
  label: string;
  value: string;
}

export interface ChannelOutput {
  id: string;
  type: ChannelOutputType;
  label: string;
  summary: string;
  isPrimary: boolean;
  blocks: ChannelOutputBlock[];
}

export interface MaterialCanvasSpec {
  width: number;
  height: number;
  unit: 'px';
  dpi?: number;
}

export interface MaterialTextBlock {
  id: string;
  role: 'headline' | 'subheadline' | 'body' | 'cta' | 'contact';
  label: string;
  value: string;
}

export interface MaterialImageSlot {
  id: string;
  prompt: string;
  alt: string;
  imageUrl: string | null;
  status: ImageRenderStatus;
  imageBase64?: string | null;
  errorMessage?: string | null;
}

export interface MaterialSurface {
  id: string;
  label: string;
  type: MaterialSurfaceType;
  textBlocks: MaterialTextBlock[];
  imageSlots: MaterialImageSlot[];
}

export interface CampaignAsset {
  id: string;
  type: MarketingMaterialType;
  formatId: string;
  label: string;
  canvas: MaterialCanvasSpec;
  layoutVariant: string;
  surfaces: MaterialSurface[];
  downloadFileName: string;
  isPrimary: boolean;
}

export interface CampaignConcept {
  id: string;
  angle: string;
  generationMode: GenerationMode;
  headline: string;
  subheadline: string;
  cta: string;
  channelLabel: string;
  audienceLabel: string;
  sectionType: string;
  sections: CampaignSection[];
  channelOutputs: ChannelOutput[];
  materialOutputs: CampaignAsset[];
}
