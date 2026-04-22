export const BillingCommands = {
  RECORD_USAGE: 'billing.recordUsage',
  BATCH_RECORD_USAGE: 'billing.batchRecordUsage',
  GET_USAGE_SUMMARY: 'billing.getUsageSummary',
  PREVIEW_INVOICE: 'billing.previewInvoice',
  CLOSE_BILLING_PERIOD: 'billing.closeBillingPeriod',
  GRANT_USAGE_BLOCK: 'billing.grantUsageBlock',
  CONSUME_USAGE_BLOCK: 'billing.consumeUsageBlock',
  GET_ENTITLEMENTS: 'billing.getEntitlements',
} as const;
