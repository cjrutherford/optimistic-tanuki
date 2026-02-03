export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  userId: string;
  profileId: string;
  appScope: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  description?: string;
}

export interface CreateAccount {
  name: string;
  type: string;
  balance: number;
  currency: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  description?: string;
}

export interface UpdateAccount {
  name?: string;
  type?: string;
  balance?: number;
  description?: string;
  isActive?: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description?: string;
  userId: string;
  profileId: string;
  appScope: string;
  accountId: string;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  reference?: string;
  isRecurring: boolean;
}

export interface CreateTransaction {
  amount: number;
  type: string;
  category: string;
  description?: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  accountId: string;
  transactionDate?: Date;
  reference?: string;
  isRecurring?: boolean;
}

export interface UpdateTransaction {
  description?: string;
  category?: string;
  transactionDate?: Date;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  category: string;
  userId: string;
  profileId: string;
  appScope: string;
  sku?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreateInventoryItem {
  name: string;
  description?: string;
  quantity: number;
  unitValue: number;
  category: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  sku?: string;
  location?: string;
}

export interface UpdateInventoryItem {
  name?: string;
  description?: string;
  quantity?: number;
  unitValue?: number;
  category?: string;
  isActive?: boolean;
  sku?: string;
  location?: string;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  period: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  profileId: string;
  appScope: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  alertOnExceed: boolean;
}

export interface CreateBudget {
  name: string;
  category: string;
  limit: number;
  spent?: number;
  period: string;
  startDate: Date;
  endDate: Date;
  userId?: string;
  profileId?: string;
  appScope?: string;
  alertOnExceed?: boolean;
}

export interface UpdateBudget {
  name?: string;
  category?: string;
  limit?: number;
  spent?: number;
  period?: string;
  isActive?: boolean;
  alertOnExceed?: boolean;
}
