import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FinanceService,
  FinanceTenantMember,
} from '@optimistic-tanuki/finance-ui';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `<main>
    <h1>Entity members</h1>
    <p>Manage access to this entity.</p>
    <form (ngSubmit)="add()">
      <label
        >Profile ID
        <input name="profileId" [(ngModel)]="profileId" required /></label
      ><label
        >Role
        <select name="role" [(ngModel)]="role">
          <option value="finance_member">Member</option>
          <option value="finance_admin">Admin</option>
        </select></label
      ><button [disabled]="busy()">Add member</button>
    </form>
    @if (message()) {
    <p aria-live="polite">{{ message() }}</p>
    }
    <ul>
      @for (member of members(); track member.id) {
      <li>
        <code>{{ member.profileId }}</code>
        <select
          [ngModel]="member.role"
          (ngModelChange)="changeRole(member.id, $event)"
        >
          <option value="finance_member">Member</option>
          <option value="finance_admin">Admin</option></select
        ><button type="button" (click)="remove(member.id)">Remove</button>
      </li>
      }
    </ul>
  </main>`,
})
export class EntityMembersPageComponent {
  private readonly finance = inject(FinanceService);
  readonly members = signal<FinanceTenantMember[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  profileId = '';
  role: 'finance_member' | 'finance_admin' = 'finance_member';
  constructor() {
    void this.refresh();
  }
  async refresh() {
    this.members.set(await this.finance.getTenantMembers());
  }
  async add() {
    await this.run(() =>
      this.finance.addTenantMember({
        memberProfileId: this.profileId,
        role: this.role,
      })
    );
    this.profileId = '';
  }
  async changeRole(id: string, role: 'finance_member' | 'finance_admin') {
    await this.run(() => this.finance.updateTenantMemberRole(id, role));
  }
  async remove(id: string) {
    await this.run(() => this.finance.removeTenantMember(id));
  }
  private async run(action: () => Promise<unknown>) {
    try {
      this.busy.set(true);
      await action();
      await this.refresh();
      this.message.set('Entity membership updated.');
    } catch {
      this.message.set('Unable to update entity membership.');
    } finally {
      this.busy.set(false);
    }
  }
}
