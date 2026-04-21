export interface BillingScope {
  tenantId: string;
  appScope: string;
}

export interface ScopedBillingRecord extends BillingScope {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
