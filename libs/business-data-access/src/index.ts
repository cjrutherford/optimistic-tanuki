import { DEFAULT_BUSINESS_SITE_CONFIG } from './lib/business-site.config';
import { BusinessApiService } from './lib/business-api.service';
import { BusinessAuthService } from './lib/business-auth.service';
import { businessHttpInterceptor } from './lib/business-http.interceptor';
import { BusinessSiteConfigStore } from './lib/business-site-config.store';
import { injectSiteSlugSignal } from './lib/site-slug.util';

export { DEFAULT_BUSINESS_SITE_CONFIG };
export { BusinessSiteConfigStore };
export { BusinessApiService };
export { BusinessAuthService };
export { businessHttpInterceptor };
export { injectSiteSlugSignal };
export {
  BUSINESS_SITE_APP_SCOPE,
  createBusinessAuthState,
  normalizeBusinessReturnTo,
  transitionBusinessAuthState,
} from './lib/business-auth.state';
export type {
  BusinessAuthRecoveryIntent,
  BusinessAuthState,
  BusinessAuthStateEvent,
  BusinessAuthStateStatus,
  BusinessIdentity,
  BusinessSessionKind,
  BusinessSessionMetadata,
} from './lib/business-auth.state';
export type { BusinessAuthUser } from './lib/business-auth.service';
export {
  cloneBusinessSiteConfig,
  mergeBusinessSiteConfig,
  normalizeLandingSections,
} from './lib/business-site.config';
export type { BusinessSiteConfig } from './lib/business-site.config';

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
  BusinessFeatureCatalog,
  BusinessOffer,
  BusinessBlogPost,
  BusinessStoreProduct,
  BusinessBusyWindow,
  BusinessClientBookingStatus,
  BusinessRelationshipStage,
  BusinessRelationshipPrimaryAction,
  AcceptedBusinessClient,
  BusinessAssetLibraryItem,
  PublicBusinessSiteSummary,
  BusinessOwnerWorkflowBucket,
  BusinessOwnerWorkflowRecord,
} from './lib/business-api.service';
