import { OptomisitcTanukiAPIService } from './generated/finance';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client: all finance routes must stay present.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
const METHODS = [
  'financeControllerApproveFinCommanderFundingDirective',
  'financeControllerBootstrapWorkspaces',
  'financeControllerCancelFinCommanderFundingDirective',
  'financeControllerConnectBankProvider',
  'financeControllerCreateAccount',
  'financeControllerCreateBankLinkToken',
  'financeControllerCreateBudget',
  'financeControllerCreateCheckoutSession',
  'financeControllerCreateFinCommanderGoal',
  'financeControllerCreateFinCommanderPlan',
  'financeControllerCreateFinCommanderScenario',
  'financeControllerCreateInventoryItem',
  'financeControllerCreateInvoice',
  'financeControllerCreateRecurringItem',
  'financeControllerCreateTenant',
  'financeControllerCreateTenantMember',
  'financeControllerCreateTransaction',
  'financeControllerDeleteAccount',
  'financeControllerDeleteBudget',
  'financeControllerDeleteFinCommanderGoal',
  'financeControllerDeleteFinCommanderPlan',
  'financeControllerDeleteFinCommanderScenario',
  'financeControllerDeleteInventoryItem',
  'financeControllerDeleteRecurringItem',
  'financeControllerDeleteTransaction',
  'financeControllerDisconnectBankConnection',
  'financeControllerGetAccount',
  'financeControllerGetAllAccounts',
  'financeControllerGetAllBudgets',
  'financeControllerGetAllInventoryItems',
  'financeControllerGetAllRecurringItems',
  'financeControllerGetAllTransactions',
  'financeControllerGetBudget',
  'financeControllerGetCheckoutSession',
  'financeControllerGetCurrentTenant',
  'financeControllerGetFinCommanderCashFlowProjection',
  'financeControllerGetFinCommanderGoal',
  'financeControllerGetFinCommanderPlan',
  'financeControllerGetFinCommanderScenario',
  'financeControllerGetInventoryItem',
  'financeControllerGetInvoice',
  'financeControllerGetOnboardingState',
  'financeControllerGetRecurringItem',
  'financeControllerGetSummary',
  'financeControllerGetTransaction',
  'financeControllerGetTransactionsByAccount',
  'financeControllerGetWorkQueue',
  'financeControllerListBankConnections',
  'financeControllerListCheckoutSessions',
  'financeControllerListFinCommanderGoals',
  'financeControllerListFinCommanderPlans',
  'financeControllerListFinCommanderScenarios',
  'financeControllerListInvoices',
  'financeControllerListTenantMembers',
  'financeControllerListTenants',
  'financeControllerPreviewFinCommanderFundingDirective',
  'financeControllerReceivePlaidWebhook',
  'financeControllerRecordInvoicePayment',
  'financeControllerRemoveTenantMember',
  'financeControllerSendInvoice',
  'financeControllerSyncBankConnection',
  'financeControllerUpdateAccount',
  'financeControllerUpdateBudget',
  'financeControllerUpdateFinCommanderGoal',
  'financeControllerUpdateFinCommanderPlan',
  'financeControllerUpdateFinCommanderScenario',
  'financeControllerUpdateInventoryItem',
  'financeControllerUpdateInvoice',
  'financeControllerUpdateRecurringItem',
  'financeControllerUpdateTenantMember',
  'financeControllerUpdateTransaction',
  'financeControllerVoidInvoice',
] as const;

describe('generated finance client operations', () => {
  it('exposes all finance operations', () => {
    expect(METHODS).toHaveLength(72);
    for (const method of METHODS) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
