export type OfferingKind = 'preset-app' | 'service' | 'library' | 'custom-app';
export type CampaignIntent = 'awareness' | 'conversion' | 'launch';
export type ChannelType = 'web' | 'email' | 'social';
export type ToneStyle = 'editorial' | 'direct' | 'technical' | 'warm';
export type GenerationMode = 'template' | 'hybrid';
export type GenerationProvenance =
  | 'template-only'
  | 'ai-enriched'
  | 'ai-fallback';
export type ConceptWorkflowStatus =
  | 'candidate'
  | 'shortlisted'
  | 'selected'
  | 'archived';
export type DeliveryModel = 'hosted' | 'self-hosted' | 'hybrid' | 'npm-package';
export type PricingModel =
  | 'metered'
  | 'block-usage'
  | 'subscription-unlimited'
  | 'free';
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
export type MaterialTemplateFamily =
  | 'print-flyer'
  | 'print-brochure'
  | 'print-business-card'
  | 'web-display-ad'
  | 'web-landing-promo';
export type ImageRenderStatus =
  | 'prompt-ready'
  | 'prompt-disabled'
  | 'queued'
  | 'complete';
export type MarketingEventType =
  | 'generation_requested'
  | 'generation_regenerated'
  | 'concept_selected'
  | 'concept_shortlisted'
  | 'concept_compared'
  | 'compare_winner_selected'
  | 'bundle_exported'
  | 'output_copied'
  | 'output_downloaded'
  | 'material_copied'
  | 'material_downloaded'
  | 'block_updated'
  | 'block_regenerated'
  | 'workspace_version_saved'
  | 'workspace_version_restored';
export type FeedbackSentiment = 'positive' | 'negative';

export interface OfferingPreset {
  id: string;
  kind: Exclude<OfferingKind, 'custom-app'>;
  name: string;
  category: string;
  summary: string;
  differentiators: string[];
  features: string[];
  audienceHint: string;
  positioning?: string;
  valueProposition?: string;
  objectives?: string[];
  proofPoints?: string[];
  adArchetypes?: string[];
  deliveryModel?: DeliveryModel;
  pricingModel?: PricingModel;
  selfHostedNote?: string;
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
  secondaryChannels: ChannelType[];
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
  templateFamily?: MaterialTemplateFamily;
  templateName?: string;
  surfaces: MaterialSurface[];
  downloadFileName: string;
  isPrimary: boolean;
}

export interface CampaignConcept {
  id: string;
  angle: string;
  generationMode: GenerationMode;
  generationProvenance?: GenerationProvenance;
  workflowStatus?: ConceptWorkflowStatus;
  rubric?: {
    clarity: number;
    differentiation: number;
    specificity: number;
    actionability: number;
  };
  headline: string;
  subheadline: string;
  cta: string;
  channelLabel: string;
  audienceLabel: string;
  sectionType: string;
  positioning?: string;
  valueProposition?: string;
  objectives?: string[];
  proofPoints?: string[];
  deliveryModel?: DeliveryModel;
  pricingModel?: PricingModel;
  selfHostedNote?: string;
  sections: CampaignSection[];
  channelOutputs: ChannelOutput[];
  materialOutputs: CampaignAsset[];
}

export interface MarketingWorkspaceVersion {
  id: string;
  name: string;
  createdAt: string;
  request: GenerationRequest;
  concepts: CampaignConcept[];
  selectedConceptId: string;
  decisionSummary?: string;
}

export interface MarketingWorkspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  request: GenerationRequest;
  concepts: CampaignConcept[];
  selectedConceptId: string;
  decisionSummary?: string;
  versions: MarketingWorkspaceVersion[];
}

export interface MarketingWorkspaceStatus {
  storageLabel: string;
  currentWorkspaceName: string;
  workspaceCount: number;
  currentVersionCount: number;
  conceptCount: number;
  lastSavedAt: string;
}

export interface MarketingEvent {
  id: string;
  type: MarketingEventType;
  createdAt: string;
  workspaceId?: string;
  conceptId?: string;
  outputId?: string;
  blockId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ConceptFeedbackEntry {
  id: string;
  workspaceId?: string;
  conceptId: string;
  sentiment: FeedbackSentiment;
  reason: string;
  createdAt: string;
}
