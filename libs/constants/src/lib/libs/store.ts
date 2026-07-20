const ProductCommands = {
  CREATE_PRODUCT: { cmd: 'createProduct' },
  FIND_ALL_PRODUCTS: { cmd: 'findAllProducts' },
  FIND_ONE_PRODUCT: { cmd: 'findOneProduct' },
  FIND_OWNER_PRODUCTS: { cmd: 'findOwnerProducts' },
  UPDATE_PRODUCT: { cmd: 'updateProduct' },
  REMOVE_PRODUCT: { cmd: 'removeProduct' },
};

const SubscriptionCommands = {
  CREATE_SUBSCRIPTION: { cmd: 'createSubscription' },
  FIND_ALL_SUBSCRIPTIONS: { cmd: 'findAllSubscriptions' },
  FIND_USER_SUBSCRIPTIONS: { cmd: 'findUserSubscriptions' },
  FIND_ONE_SUBSCRIPTION: { cmd: 'findOneSubscription' },
  UPDATE_SUBSCRIPTION: { cmd: 'updateSubscription' },
  CANCEL_SUBSCRIPTION: { cmd: 'cancelSubscription' },
};

const DonationCommands = {
  CREATE_DONATION: { cmd: 'createDonation' },
  FIND_ALL_DONATIONS: { cmd: 'findAllDonations' },
  FIND_USER_DONATIONS: { cmd: 'findUserDonations' },
  FIND_ONE_DONATION: { cmd: 'findOneDonation' },
};

const PaymentCommands = {
  GET_DONATION_GOAL: 'payments.getDonationGoal',
  LIST_DONATIONS: 'payments.listDonations',
  CREATE_DONATION_CHECKOUT: 'payments.createDonationCheckout',
  GET_USER_DONATIONS: 'payments.getUserDonations',
  CANCEL_SUBSCRIPTION: 'payments.cancelSubscription',
  CREATE_CLASSIFIED_PAYMENT: 'payments.createClassifiedPayment',
  CONFIRM_OUT_OF_PLATFORM_PAYMENT: 'payments.confirmOutOfPlatformPayment',
  RELEASE_FUNDS: 'payments.releaseFunds',
  DISPUTE_PAYMENT: 'payments.disputePayment',
  GET_PAYMENT: 'payments.get',
  GET_USER_PAYMENTS: 'payments.getUserPayments',
  MARK_INTERESTED_BUYER: 'payments.markInterestedBuyer',
  MARK_PAID_OUTSIDE_PLATFORM: 'payments.markPaidOutsidePlatform',
  CREATE_BUSINESS_CHECKOUT: 'payments.createBusinessCheckout',
  GET_BUSINESS_PAGE: 'payments.getBusinessPage',
  GET_OWNER_BUSINESS_PAGES: 'payments.getOwnerBusinessPages',
  LIST_ACTIVE_BUSINESS_PAGES: 'payments.listActiveBusinessPages',
  UPDATE_BUSINESS_PAGE: 'payments.updateBusinessPage',
  UPDATE_OWNER_BUSINESS_PAGE: 'payments.updateOwnerBusinessPage',
  CANCEL_BUSINESS_SUBSCRIPTION: 'payments.cancelBusinessSubscription',
  CREATE_BUSINESS_THEME: 'payments.createBusinessTheme',
  GET_BUSINESS_THEME: 'payments.getBusinessTheme',
  UPDATE_BUSINESS_THEME: 'payments.updateBusinessTheme',
  CREATE_ADVERTISING_CAMPAIGN: 'payments.createAdvertisingCampaign',
  UPDATE_ADVERTISING_CAMPAIGN: 'payments.updateAdvertisingCampaign',
  GET_OWNER_ADVERTISING_CAMPAIGNS: 'payments.getOwnerAdvertisingCampaigns',
  UPDATE_ADVERTISING_CAMPAIGN_STATUS:
    'payments.updateAdvertisingCampaignStatus',
  GET_ELIGIBLE_ON_PAGE_CAMPAIGNS: 'payments.getEligibleOnPageCampaigns',
  GET_ELIGIBLE_PLAYBACK_CAMPAIGNS: 'payments.getEligiblePlaybackCampaigns',
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
  UPDATE_SELLER_PAYOUT_INFO: 'payments.updateSellerPayoutInfo',
  CREATE_PAYOUT_REQUEST: 'payments.createPayoutRequest',
  GET_SELLER_PAYOUT_REQUESTS: 'payments.getSellerPayoutRequests',
  CANCEL_PAYOUT_REQUEST: 'payments.cancelPayoutRequest',
  GET_SELLER_EARNINGS_SUMMARY: 'payments.getSellerEarningsSummary',
  GET_BUSINESS_PAGES_BY_CITY: 'payments.getBusinessPagesByCity',
  PROCESS_WEBHOOK: 'payments.processWebhook',
  SYNC_LEMON_SQUEEZY_PRODUCTS: 'payments.syncLemonSqueezyProducts',
};

const OrderCommands = {
  CREATE_ORDER: { cmd: 'createOrder' },
  FIND_ALL_ORDERS: { cmd: 'findAllOrders' },
  FIND_USER_ORDERS: { cmd: 'findUserOrders' },
  FIND_ONE_ORDER: { cmd: 'findOneOrder' },
  UPDATE_ORDER: { cmd: 'updateOrder' },
};

export {
  ProductCommands,
  SubscriptionCommands,
  DonationCommands,
  PaymentCommands,
  OrderCommands,
};
