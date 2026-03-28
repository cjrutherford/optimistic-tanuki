const ProductCommands = {
  CREATE_PRODUCT: 'createProduct',
  FIND_ALL_PRODUCTS: 'findAllProducts',
  FIND_ONE_PRODUCT: 'findOneProduct',
  UPDATE_PRODUCT: 'updateProduct',
  REMOVE_PRODUCT: 'removeProduct',
};

const SubscriptionCommands = {
  CREATE_SUBSCRIPTION: 'createSubscription',
  FIND_ALL_SUBSCRIPTIONS: 'findAllSubscriptions',
  FIND_USER_SUBSCRIPTIONS: 'findUserSubscriptions',
  FIND_ONE_SUBSCRIPTION: 'findOneSubscription',
  UPDATE_SUBSCRIPTION: 'updateSubscription',
  CANCEL_SUBSCRIPTION: 'cancelSubscription',
};

const DonationCommands = {
  CREATE_DONATION: 'createDonation',
  FIND_ALL_DONATIONS: 'findAllDonations',
  FIND_USER_DONATIONS: 'findUserDonations',
  FIND_ONE_DONATION: 'findOneDonation',
};

const PaymentCommands = {
  GET_DONATION_GOAL: 'payments.getDonationGoal',
  LIST_DONATIONS: 'payments.listDonations',
  CREATE_DONATION_CHECKOUT: 'payments.createDonationCheckout',
  INITIALIZE_DONATION_CHECKOUT: 'payments.initializeDonationCheckout',
  VALIDATE_DONATION_CHECKOUT: 'payments.validateDonationCheckout',
  REFUND_DONATION: 'payments.refundDonation',
  GET_USER_DONATIONS: 'payments.getUserDonations',
  CANCEL_SUBSCRIPTION: 'payments.cancelSubscription',
  CREATE_CLASSIFIED_PAYMENT: 'payments.createClassifiedPayment',
  INITIALIZE_CLASSIFIED_PAYMENT: 'payments.initializeClassifiedPayment',
  VALIDATE_CLASSIFIED_PAYMENT: 'payments.validateClassifiedPayment',
  CONFIRM_STRIPE_CLASSIFIED_PAYMENT: 'payments.confirmStripeClassifiedPayment',
  REFUND_CLASSIFIED_PAYMENT: 'payments.refundClassifiedPayment',
  CONFIRM_OUT_OF_PLATFORM_PAYMENT: 'payments.confirmOutOfPlatformPayment',
  RELEASE_FUNDS: 'payments.releaseFunds',
  DISPUTE_PAYMENT: 'payments.disputePayment',
  GET_PAYMENT: 'payments.get',
  GET_USER_PAYMENTS: 'payments.getUserPayments',
  MARK_INTERESTED_BUYER: 'payments.markInterestedBuyer',
  MARK_PAID_OUTSIDE_PLATFORM: 'payments.markPaidOutsidePlatform',
  CREATE_BUSINESS_CHECKOUT: 'payments.createBusinessCheckout',
  GET_BUSINESS_PAGE: 'payments.getBusinessPage',
  UPDATE_BUSINESS_PAGE: 'payments.updateBusinessPage',
  CANCEL_BUSINESS_SUBSCRIPTION: 'payments.cancelBusinessSubscription',
  CREATE_BUSINESS_THEME: 'payments.createBusinessTheme',
  GET_BUSINESS_THEME: 'payments.getBusinessTheme',
  UPDATE_BUSINESS_THEME: 'payments.updateBusinessTheme',
  CREATE_SPONSORSHIP_CHECKOUT: 'payments.createSponsorshipCheckout',
  GET_ACTIVE_SPONSORSHIPS: 'payments.getActiveSponsorships',
  GET_USER_SPONSORSHIPS: 'payments.getUserSponsorships',
  GET_USER_TRANSACTIONS: 'payments.getUserTransactions',
  GET_PORTAL_URL: 'payments.getPortalUrl',
  CREATE_OFFER: 'payments.createOffer',
  ACCEPT_OFFER: 'payments.acceptOffer',
  REJECT_OFFER: 'payments.rejectOffer',
  COUNTER_OFFER: 'payments.counterOffer',
  WITHDRAW_OFFER: 'payments.withdrawOffer',
  GET_OFFERS_FOR_CLASSIFIED: 'payments.getOffersForClassified',
  GET_USER_OFFERS: 'payments.getUserOffers',
  GET_SELLER_WALLET: 'payments.getSellerWallet',
  CREATE_SELLER_STRIPE_CONNECT_ONBOARDING_LINK:
    'payments.createSellerStripeConnectOnboardingLink',
  REFRESH_SELLER_STRIPE_CONNECT_STATUS:
    'payments.refreshSellerStripeConnectStatus',
  UPDATE_SELLER_PAYOUT_INFO: 'payments.updateSellerPayoutInfo',
  CREATE_PAYOUT_REQUEST: 'payments.createPayoutRequest',
  GET_SELLER_PAYOUT_REQUESTS: 'payments.getSellerPayoutRequests',
  CANCEL_PAYOUT_REQUEST: 'payments.cancelPayoutRequest',
  GET_SELLER_EARNINGS_SUMMARY: 'payments.getSellerEarningsSummary',
  GET_BUSINESS_PAGES_BY_CITY: 'payments.getBusinessPagesByCity',
  GET_BILLING_PROFILE: 'payments.getBillingProfile',
  UPDATE_BILLING_PROFILE: 'payments.updateBillingProfile',
  LIST_SAVED_PAYMENT_METHODS: 'payments.listSavedPaymentMethods',
  PROCESS_WEBHOOK: 'payments.processWebhook',
  SYNC_LEMON_SQUEEZY_PRODUCTS: 'payments.syncLemonSqueezyProducts',
};

const OrderCommands = {
  CREATE_ORDER: 'createOrder',
  FIND_ALL_ORDERS: 'findAllOrders',
  FIND_USER_ORDERS: 'findUserOrders',
  FIND_ONE_ORDER: 'findOneOrder',
  UPDATE_ORDER: 'updateOrder',
};

export {
  ProductCommands,
  SubscriptionCommands,
  DonationCommands,
  PaymentCommands,
  OrderCommands,
};
