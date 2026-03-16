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
  UPDATE_BUSINESS_PAGE: 'payments.updateBusinessPage',
  CANCEL_BUSINESS_SUBSCRIPTION: 'payments.cancelBusinessSubscription',
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
