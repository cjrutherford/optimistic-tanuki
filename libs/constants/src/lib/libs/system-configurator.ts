export const HardwareCommands = {
  GET_CHASSIS: 'system-configurator.hardware.getChassis',
  GET_CHASSIS_BY_ID: 'system-configurator.hardware.getChassisById',
  GET_COMPATIBLE_COMPONENTS:
    'system-configurator.hardware.getCompatibleComponents',
  CALCULATE_PRICE: 'system-configurator.hardware.calculatePrice',
  CREATE_ORDER: 'system-configurator.hardware.createOrder',
  GET_ORDER: 'system-configurator.hardware.getOrder',
  SAVE_CONFIGURATION: 'system-configurator.hardware.saveConfiguration',
  GET_CONFIGURATION: 'system-configurator.hardware.getConfiguration',
  GET_TIERS: 'system-configurator.hardware.getTiers',
  LIST_SUPPLIER_OFFERS: 'system-configurator.hardware.listSupplierOffers',
  SEARCH_AMAZON_BUSINESS_OFFERS:
    'system-configurator.hardware.searchAmazonBusinessOffers',
  IMPORT_SUPPLIER_OFFERS: 'system-configurator.hardware.importSupplierOffers',
  ISSUE_COMMERCIAL_QUOTE: 'system-configurator.hardware.issueCommercialQuote',
  GET_COMMERCIAL_QUOTE: 'system-configurator.hardware.getCommercialQuote',
  ACCEPT_COMMERCIAL_QUOTE: 'system-configurator.hardware.acceptCommercialQuote',
  GENERATE_CLIENT_DEPLOYMENT_ARTIFACTS:
    'system-configurator.hardware.generateClientDeploymentArtifacts',
  PROBE_OPERATOR_ACCESS: 'system-configurator.hardware.probeOperatorAccess',
} as const;
