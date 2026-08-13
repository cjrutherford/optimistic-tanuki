import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FinanceService,
  FinanceTenantMember,
} from '@optimistic-tanuki/finance-ui';
import { ProfileContext } from '../../profile.context';
import { TenantContextService } from '../../tenant-context.service';

type MemberRole = 'finance_admin' | 'finance_member';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="people-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">People & access</p>
          <h1>Collaborators</h1>
          <p class="lede">
            Work together in <strong>{{ tenantName() }}</strong
            >. Everyone in this list shares the same Fin Commander tenant state.
          </p>
        </div>
        <span class="tenant-chip" aria-label="Active tenant">{{
          tenantName()
        }}</span>
      </header>

      @if (loading()) {
      <p class="state" aria-live="polite">Loading collaborators…</p>
      } @else if (accessDenied()) {
      <section class="state state-error" role="alert">
        <h2>Access to People is restricted</h2>
        <p>{{ message() }}</p>
        <button type="button" (click)="refresh()">Try again</button>
      </section>
      } @else { @if (message()) {
      <p class="notice" aria-live="polite">{{ message() }}</p>
      } @if (!isOperator()) {
      <p class="notice notice-muted">
        You have view-only access to this tenant’s collaborators. An operator
        can invite people, change roles, or revoke access.
      </p>
      } @if (isOperator()) {
      <section class="invite-card" aria-labelledby="invite-heading">
        <div>
          <p class="eyebrow">Add access</p>
          <h2 id="invite-heading">Invite a collaborator</h2>
          <p>Use the profile ID of someone who should join this tenant.</p>
        </div>
        <form (ngSubmit)="add()">
          <label>
            Profile ID
            <input
              name="profileId"
              [(ngModel)]="profileId"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autocomplete="off"
              required
            />
          </label>
          <label>
            Role
            <select name="role" [(ngModel)]="role">
              <option value="finance_member">Member — collaborate</option>
              <option value="finance_admin">Operator — manage access</option>
            </select>
          </label>
          <button type="submit" [disabled]="busy()">Add collaborator</button>
        </form>
      </section>
      }

      <section class="members-card" aria-labelledby="members-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Tenant access</p>
            <h2 id="members-heading">Active collaborators</h2>
          </div>
          <span>{{ members().length }} people</span>
        </div>
        @if (members().length === 0) {
        <p class="state">No collaborators have been added yet.</p>
        } @else {
        <ul class="member-list">
          @for (member of members(); track member.id) {
          <li class="member-row">
            <div class="member-identity">
              <span class="avatar">{{ initials(member.profileId) }}</span>
              <div>
                <strong>{{ member.profileId }}</strong>
                <span class="member-status">Active in this tenant</span>
              </div>
            </div>
            @if (isOperator()) {
            <div class="member-actions">
              <label class="sr-only" [for]="'role-' + member.id"
                >Role for {{ member.profileId }}</label
              >
              <select
                [id]="'role-' + member.id"
                [ngModel]="member.role"
                [disabled]="busy()"
                (ngModelChange)="changeRole(member, $event)"
              >
                <option value="finance_member">Member</option>
                <option value="finance_admin">Operator</option>
              </select>
              <button
                type="button"
                class="danger-button"
                [disabled]="busy()"
                (click)="remove(member.id)"
              >
                Revoke access
              </button>
            </div>
            } @else {
            <span class="role-badge">{{ roleLabel(member.role) }}</span>
            }
          </li>
          }
        </ul>
        }
      </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .people-page {
        display: grid;
        gap: 1rem;
      }
      .page-header,
      .invite-card,
      .members-card {
        background: var(--surface);
        border: 1px solid color-mix(in srgb, var(--border) 38%, transparent);
        border-radius: 1rem;
        padding: clamp(1rem, 3vw, 1.5rem);
      }
      .page-header,
      .section-heading,
      .member-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }
      .eyebrow {
        margin: 0 0 0.3rem;
        color: var(--accent);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1,
      h2,
      p {
        margin-top: 0;
      }
      h1 {
        margin-bottom: 0.45rem;
      }
      h2 {
        margin-bottom: 0.4rem;
        font-size: 1.1rem;
      }
      .lede,
      .invite-card p:not(.eyebrow),
      .state p {
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        margin-bottom: 0;
      }
      .tenant-chip,
      .role-badge {
        border-radius: 999px;
        background: color-mix(in srgb, var(--accent) 14%, transparent);
        color: var(--accent);
        padding: 0.35rem 0.65rem;
        font-size: 0.8rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .invite-card {
        display: grid;
        grid-template-columns: minmax(180px, 0.8fr) 1.4fr;
        gap: 1.25rem;
        align-items: end;
      }
      form {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(150px, 1fr) auto;
        gap: 0.75rem;
        align-items: end;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.8rem;
        font-weight: 700;
      }
      input,
      select,
      button {
        min-height: 2.5rem;
        border-radius: 0.6rem;
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        padding: 0.5rem 0.7rem;
        font: inherit;
      }
      button {
        cursor: pointer;
        background: var(--accent);
        color: var(--surface);
        font-weight: 700;
      }
      button:disabled {
        cursor: wait;
        opacity: 0.55;
      }
      .danger-button {
        background: transparent;
        color: var(--danger);
      }
      .notice,
      .state {
        margin: 0;
        padding: 0.8rem 1rem;
        border-radius: 0.7rem;
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      .notice-muted {
        color: color-mix(in srgb, var(--foreground) 75%, transparent);
      }
      .state-error {
        background: color-mix(in srgb, var(--danger) 10%, transparent);
      }
      .state-error button {
        margin-top: 1rem;
      }
      .section-heading {
        align-items: center;
        margin-bottom: 0.8rem;
      }
      .section-heading > span {
        color: color-mix(in srgb, var(--foreground) 60%, transparent);
        font-size: 0.85rem;
      }
      .member-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .member-row {
        align-items: center;
        padding: 0.9rem 0;
        border-top: 1px solid color-mix(in srgb, var(--border) 28%, transparent);
      }
      .member-identity,
      .member-actions {
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .member-identity strong,
      .member-status {
        display: block;
        overflow-wrap: anywhere;
      }
      .member-status {
        color: color-mix(in srgb, var(--foreground) 58%, transparent);
        font-size: 0.78rem;
        margin-top: 0.2rem;
      }
      .avatar {
        display: grid;
        place-items: center;
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--accent);
        font-weight: 800;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      @media (max-width: 760px) {
        .page-header,
        .invite-card,
        .member-row {
          display: grid;
        }
        .invite-card form,
        form {
          grid-template-columns: 1fr;
        }
        .member-actions {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class EntityMembersPageComponent {
  private readonly finance = inject(FinanceService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly profileContext = inject(ProfileContext);

  readonly members = signal<FinanceTenantMember[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly accessDenied = signal(false);
  readonly message = signal('');
  readonly tenantName = computed(
    () => this.tenantContext.activeTenant()?.name ?? 'Active tenant'
  );
  readonly isOperator = computed(() => {
    const profileId = this.profileContext.currentProfileId();
    const tenant = this.tenantContext.activeTenant();
    return (
      !!profileId &&
      (tenant?.profileId === profileId ||
        this.members().some(
          (member) =>
            member.profileId === profileId && member.role === 'finance_admin'
        ))
    );
  });

  profileId = '';
  role: MemberRole = 'finance_member';

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.accessDenied.set(false);
    try {
      this.members.set(await this.finance.getTenantMembers());
      this.message.set('');
    } catch (error) {
      this.accessDenied.set(
        [401, 403, 404].includes(this.statusOf(error) ?? 0)
      );
      this.message.set(
        this.accessDenied()
          ? 'Only tenant operators can view collaborator access. Ask an operator to manage this tenant.'
          : 'Collaborators could not be loaded. Check your connection and try again.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    const profileId = this.profileId.trim();
    if (!this.isUuid(profileId)) {
      this.message.set(
        'Enter a valid profile ID (UUID) before adding a collaborator.'
      );
      return;
    }
    await this.run(
      () =>
        this.finance.addTenantMember({
          memberProfileId: profileId,
          role: this.role,
        }),
      'Collaborator added.'
    );
    if (
      !this.message().includes('could not') &&
      !this.message().includes('permission')
    )
      this.profileId = '';
  }

  async changeRole(
    member: FinanceTenantMember,
    role: MemberRole
  ): Promise<void> {
    if (member.role === role) return;
    await this.run(
      () => this.finance.updateTenantMemberRole(member.id, role),
      'Collaborator role updated.'
    );
  }

  async remove(id: string): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Revoke this collaborator’s access to the tenant?')
    )
      return;
    await this.run(
      () => this.finance.removeTenantMember(id),
      'Access revoked. The collaborator can no longer open this tenant.'
    );
  }

  roleLabel(role: string): string {
    return role === 'finance_admin' ? 'Operator' : 'Member';
  }

  initials(profileId: string): string {
    return profileId.slice(0, 2).toUpperCase();
  }

  private async run(
    action: () => Promise<unknown>,
    success: string
  ): Promise<void> {
    try {
      this.busy.set(true);
      await action();
      await this.refresh();
      this.message.set(success);
    } catch (error) {
      this.message.set(
        [401, 403, 404].includes(this.statusOf(error) ?? 0)
          ? 'You do not have permission to change collaborator access.'
          : 'The collaborator change could not be saved. Try again.'
      );
    } finally {
      this.busy.set(false);
    }
  }

  private statusOf(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }
}
