import { Injectable } from '@angular/core';

export type GovernanceAuditKind =
  | 'bulk-role-mutation'
  | 'role-permission-added'
  | 'role-permission-removed'
  | 'role-updated'
  | 'role-deleted';

export interface GovernanceAuditEntry {
  id: string;
  kind: GovernanceAuditKind;
  occurredAt: string;
  operation?: 'assign' | 'unassign';
  roleId: string;
  roleName: string;
  permissionId?: string;
  profileIds?: string[];
  appScopeId?: string;
  targetId?: string;
  summary: string;
}

const GOVERNANCE_AUDIT_STORAGE_KEY = 'owner-console.governance-audit.v1';

@Injectable({
  providedIn: 'root',
})
export class GovernanceAuditService {
  getEntries(): GovernanceAuditEntry[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(GOVERNANCE_AUDIT_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as GovernanceAuditEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  recordEntry(entry: Omit<GovernanceAuditEntry, 'id' | 'occurredAt'>): void {
    const nextEntry: GovernanceAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      occurredAt: new Date().toISOString(),
    };

    const entries = [nextEntry, ...this.getEntries()].slice(0, 25);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        GOVERNANCE_AUDIT_STORAGE_KEY,
        JSON.stringify(entries)
      );
    }
  }
}
