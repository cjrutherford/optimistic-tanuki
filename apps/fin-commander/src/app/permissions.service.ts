import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private readonly grantedPermissions = new Set<string>([
    'finance.summary.read',
    'finance.account.read',
    'finance.transaction.read',
    'finance.budget.read',
    'finance.member.manage',
    'finance.tenant.manage',
  ]);

  can(permission: string): boolean {
    return this.grantedPermissions.has(permission);
  }
}
