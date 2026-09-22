export const ProductCommands = {
  CREATE_PRODUCT: { cmd: 'createProduct' },
  FIND_ALL_PRODUCTS: { cmd: 'findAllProducts' },
  FIND_ONE_PRODUCT: { cmd: 'findOneProduct' },
  FIND_OWNER_PRODUCTS: { cmd: 'findOwnerProducts' },
  UPDATE_PRODUCT: { cmd: 'updateProduct' },
  REMOVE_PRODUCT: { cmd: 'removeProduct' },
};

export const CatalogCommands = {
  CREATE_STORE_CATALOG: { cmd: 'createStoreCatalog' },
  FIND_STORE_CATALOGS: { cmd: 'findStoreCatalogs' },
};

export const SubscriptionCommands = {
  CREATE_SUBSCRIPTION: { cmd: 'createSubscription' },
  FIND_ALL_SUBSCRIPTIONS: { cmd: 'findAllSubscriptions' },
  FIND_USER_SUBSCRIPTIONS: { cmd: 'findUserSubscriptions' },
  FIND_ONE_SUBSCRIPTION: { cmd: 'findOneSubscription' },
  UPDATE_SUBSCRIPTION: { cmd: 'updateSubscription' },
  CANCEL_SUBSCRIPTION: { cmd: 'cancelSubscription' },
};

export const DonationCommands = {
  CREATE_DONATION: { cmd: 'createDonation' },
  FIND_ALL_DONATIONS: { cmd: 'findAllDonations' },
  FIND_USER_DONATIONS: { cmd: 'findUserDonations' },
  FIND_ONE_DONATION: { cmd: 'findOneDonation' },
};

export const OrderCommands = {
  CREATE_ORDER: { cmd: 'createOrder' },
  FIND_ALL_ORDERS: { cmd: 'findAllOrders' },
  FIND_USER_ORDERS: { cmd: 'findUserOrders' },
  FIND_ONE_ORDER: { cmd: 'findOneOrder' },
  UPDATE_ORDER: { cmd: 'updateOrder' },
};
