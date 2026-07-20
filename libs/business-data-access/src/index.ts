import { DEFAULT_BUSINESS_SITE_CONFIG } from './lib/business-site.config';
import { BusinessApiService } from './lib/business-api.service';
import { BusinessAuthService } from './lib/business-auth.service';
import { businessHttpInterceptor } from './lib/business-http.interceptor';
import { BusinessSiteConfigStore } from './lib/business-site-config.store';

export { DEFAULT_BUSINESS_SITE_CONFIG };
export { DEFAULT_BUSINESS_SITE_CONFIG as DEFAULT_TRAINER_SITE_CONFIG };
export { BusinessSiteConfigStore };
export { BusinessApiService };
export { BusinessApiService as TrainerApiService };
export { BusinessAuthService };
export { BusinessAuthService as TrainerAuthService };
export { businessHttpInterceptor };
export {
  cloneBusinessSiteConfig,
  mergeBusinessSiteConfig,
  normalizeLandingSections,
} from './lib/business-site.config';
export {
  BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS,
  businessSiteConfigToConfigDocument,
  configDocumentToBusinessSiteConfig,
} from './lib/business-site-blocks';
export type { BusinessSiteConfig } from './lib/business-site.config';
export type { BusinessSiteConfig as TrainerSiteConfig } from './lib/business-site.config';

export type {
  BusinessFeatures,
  BusinessLeadContext,
  BusinessService,
  BusinessServiceCatalogConfig,
  LandingSection,
  LandingSectionType,
  LandingSectionMediaItem,
  LandingSectionGalleryConfig,
  LandingSectionMotionConfig,
  LandingSectionMotionKind,
  LandingSectionRichContent,
  LandingSectionRichContentComponent,
  LandingSectionMediaSourceType,
  LandingSectionMediaAspect,
  LandingSectionMediaFit,
  LandingSectionMediaFocalPoint,
  LandingSectionGalleryStyle,
  BusinessThemeConfig,
  BusinessTestimonial,
  SplitLayoutSlot,
  GridLayoutSlot,
} from './lib/business-site.config';
export type { SiteConfigResponse } from './lib/business-api.service';
export type { CreateBusinessBookingRequest } from './lib/business-api.service';
export type {
  Availability,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  AvailabilityOverride,
  CreateAvailabilityOverrideDto,
  UpdateAvailabilityOverrideDto,
} from '@optimistic-tanuki/ui-models';
export type {
  RoutineAssignment,
  ProgressCheckIn,
  CreateRoutineAssignment,
  CreateProgressCheckIn,
  BusinessLeadIntake,
  BusinessLeadIntakeRecord,
  BusinessOffer,
  BusinessStoreProduct,
  BusinessBusyWindow,
  BusinessClientBookingStatus,
  BusinessRelationshipStage,
  BusinessRelationshipPrimaryAction,
  AcceptedBusinessClient,
  BusinessAssetLibraryItem,
  OwnerBusinessPageRecord,
  OwnerAdvertisingCampaignRecord,
  AdvertisingCampaignStatus,
  AdvertisingCampaignPlacement,
  CreateOwnerAdvertisingCampaignDto,
  SponsorChannelOption,
  PublicBusinessSiteSummary,
  BusinessOwnerWorkflowBucket,
  BusinessOwnerWorkflowRecord,
} from './lib/business-api.service';
