import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Account,
  CreateAccount,
  UpdateAccount,
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  InventoryItem,
  CreateInventoryItem,
  UpdateInventoryItem,
  Budget,
  CreateBudget,
  UpdateBudget,
} from '../models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private http = inject(HttpClient);
  private baseUrl = '/api/finance';

  // Account methods
  async createAccount(account: CreateAccount): Promise<Account> {
    return firstValueFrom(
      this.http.post<Account>(`${this.baseUrl}/account`, account)
    );
  }

  async getAccount(id: string): Promise<Account> {
    return firstValueFrom(
      this.http.get<Account>(`${this.baseUrl}/account/${id}`)
    );
  }

  async getAccounts(): Promise<Account[]> {
    return firstValueFrom(
      this.http.get<Account[]>(`${this.baseUrl}/accounts`)
    );
  }

  async updateAccount(id: string, account: UpdateAccount): Promise<Account> {
    return firstValueFrom(
      this.http.put<Account>(`${this.baseUrl}/account/${id}`, account)
    );
  }

  async deleteAccount(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/account/${id}`)
    );
  }

  // Transaction methods
  async createTransaction(transaction: CreateTransaction): Promise<Transaction> {
    return firstValueFrom(
      this.http.post<Transaction>(`${this.baseUrl}/transaction`, transaction)
    );
  }

  async getTransaction(id: string): Promise<Transaction> {
    return firstValueFrom(
      this.http.get<Transaction>(`${this.baseUrl}/transaction/${id}`)
    );
  }

  async getTransactions(): Promise<Transaction[]> {
    return firstValueFrom(
      this.http.get<Transaction[]>(`${this.baseUrl}/transactions`)
    );
  }

  async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    return firstValueFrom(
      this.http.get<Transaction[]>(`${this.baseUrl}/account/${accountId}/transactions`)
    );
  }

  async updateTransaction(id: string, transaction: UpdateTransaction): Promise<Transaction> {
    return firstValueFrom(
      this.http.put<Transaction>(`${this.baseUrl}/transaction/${id}`, transaction)
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/transaction/${id}`)
    );
  }

  // Inventory Item methods
  async createInventoryItem(item: CreateInventoryItem): Promise<InventoryItem> {
    return firstValueFrom(
      this.http.post<InventoryItem>(`${this.baseUrl}/inventory-item`, item)
    );
  }

  async getInventoryItem(id: string): Promise<InventoryItem> {
    return firstValueFrom(
      this.http.get<InventoryItem>(`${this.baseUrl}/inventory-item/${id}`)
    );
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    return firstValueFrom(
      this.http.get<InventoryItem[]>(`${this.baseUrl}/inventory-items`)
    );
  }

  async updateInventoryItem(id: string, item: UpdateInventoryItem): Promise<InventoryItem> {
    return firstValueFrom(
      this.http.put<InventoryItem>(`${this.baseUrl}/inventory-item/${id}`, item)
    );
  }

  async deleteInventoryItem(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/inventory-item/${id}`)
    );
  }

  // Budget methods
  async createBudget(budget: CreateBudget): Promise<Budget> {
    return firstValueFrom(
      this.http.post<Budget>(`${this.baseUrl}/budget`, budget)
    );
  }

  async getBudget(id: string): Promise<Budget> {
    return firstValueFrom(
      this.http.get<Budget>(`${this.baseUrl}/budget/${id}`)
    );
  }

  async getBudgets(): Promise<Budget[]> {
    return firstValueFrom(
      this.http.get<Budget[]>(`${this.baseUrl}/budgets`)
    );
  }

  async updateBudget(id: string, budget: UpdateBudget): Promise<Budget> {
    return firstValueFrom(
      this.http.put<Budget>(`${this.baseUrl}/budget/${id}`, budget)
    );
  }

  async deleteBudget(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/budget/${id}`)
    );
  }
}
