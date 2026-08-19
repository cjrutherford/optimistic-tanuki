/**
 * UI-composition entry point for the business-site presence plugin.
 *
 * The business domain model remains in business-data-access. Consumers that
 * render or edit a configured presence use this feature boundary instead.
 */
export { BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS } from './business-presence-block-definitions';
export {
  businessSiteConfigToConfigDocument,
  configDocumentToBusinessSiteConfig,
} from './business-presence-document-adapter';
