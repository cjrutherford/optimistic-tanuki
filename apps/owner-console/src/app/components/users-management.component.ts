import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui/heading/heading.component';
import { ModalComponent } from '@optimistic-tanuki/common-ui/modal/modal.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import {
  BulkRoleMutationDto,
  BulkRoleMutationPermissionChangeDto,
  BulkRoleMutationPreviewDto,
  BulkRoleMutationResultDto,
  ProfileDto,
  ProfileTelosDto,
  RoleDto,
  UserRoleDto,
} from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AgUsersTableComponent } from './ag-users-table.component';
import {
  GovernanceAuditEntry,
  GovernanceAuditService,
} from '../services/governance-audit.service';
import { CharacterSheetComponent } from '@optimistic-tanuki/profile-ui';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    CardComponent,
    HeadingComponent,
    MessageComponent,
    ModalComponent,
    AgUsersTableComponent,
    CharacterSheetComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <div class="header-row">
        <otui-heading level="2">Users Management</otui-heading>
        <otui-button
          variant="primary"
          (action)="rebuildSeededTelos()"
          [disabled]="seededBulkRebuildLoading || seededUserIds.length === 0"
        >
          Rebuild Seeded TELOS
        </otui-button>
      </div>

      <div class="seeded-summary-strip" *ngIf="seededCharacterSummaries.length">
        <div
          class="summary-card"
          *ngFor="let summary of seededCharacterSummaries"
        >
          <strong>{{ summary.profileName }}</strong>
          <span>{{ summary.classLabel }} · {{ summary.levelLabel }}</span>
          <span>{{ summary.statusLabel }}</span>
        </div>
      </div>

      <section class="bulk-governance-panel">
        <div class="bulk-governance-copy">
          <h3>Bulk Governance</h3>
          <p>
            Preview the impact of a role change across selected profiles before
            applying it.
          </p>
          <div class="selection-stat">
            {{ selectedUsers.length }} profile{{
              selectedUsers.length === 1 ? '' : 's'
            }}
            selected
          </div>
        </div>

        <div class="bulk-governance-controls">
          <label class="control-field">
            <span>Operation</span>
            <select
              [ngModel]="bulkOperation"
              (ngModelChange)="onBulkOperationChange($event)"
            >
              <option value="assign">Assign role</option>
              <option value="unassign">Remove role</option>
            </select>
          </label>

          <label class="control-field">
            <span>Role</span>
            <select
              [ngModel]="bulkRoleId"
              (ngModelChange)="onBulkRoleChange($event)"
            >
              <option value="">Select a governance role</option>
              <option *ngFor="let role of rolesCatalog" [value]="role.id">
                {{ role.name }} · {{ resolveRoleScopeLabel(role) }}
              </option>
            </select>
          </label>

          <label class="control-field">
            <span>Target ID</span>
            <input
              type="text"
              [ngModel]="bulkTargetId"
              (ngModelChange)="onBulkTargetChange($event)"
              placeholder="Optional scoped target, e.g. community-1"
            />
          </label>

          <div class="bulk-actions">
            <otui-button
              variant="secondary"
              (action)="traceSelectedProfileAccess()"
              [disabled]="selectedUsers.length !== 1"
            >
              Trace Selected Access
            </otui-button>
            <otui-button
              variant="secondary"
              (action)="previewBulkRoleMutation()"
              [disabled]="!canPreviewBulkMutation"
            >
              {{ bulkPreviewLoading ? 'Previewing…' : 'Preview Impact' }}
            </otui-button>

            <otui-button
              variant="primary"
              (action)="executeBulkRoleMutation()"
              [disabled]="!canExecuteBulkMutation"
            >
              {{ bulkMutationLoading ? 'Applying…' : bulkExecuteLabel }}
            </otui-button>
          </div>
        </div>
      </section>

      <section
        class="bulk-preview-panel"
        *ngIf="bulkPreviewLoading || bulkPreview"
      >
        <div *ngIf="bulkPreviewLoading" class="empty-state">
          Calculating governance impact…
        </div>

        <div *ngIf="bulkPreview" class="preview-grid">
          <div class="preview-metric">
            <span>Selected</span>
            <strong>{{ bulkPreview.totalSelected }}</strong>
          </div>
          <div class="preview-metric">
            <span>Will change</span>
            <strong>{{ bulkPreview.affectedCount }}</strong>
          </div>
          <div class="preview-metric">
            <span>Unchanged</span>
            <strong>{{ bulkPreview.unchangedCount }}</strong>
          </div>
          <div class="preview-metric">
            <span>Role</span>
            <strong>{{ bulkPreview.roleName }}</strong>
          </div>

          <div
            class="preview-list"
            *ngIf="bulkPreview.affectedProfileIds.length > 0"
          >
            <h4>
              {{
                bulkOperation === 'assign'
                  ? 'Profiles gaining the role'
                  : 'Profiles losing the role'
              }}
            </h4>
            <p>{{ describeProfiles(bulkPreview.affectedProfileIds) }}</p>
          </div>

          <div
            class="preview-list preview-list-muted"
            *ngIf="bulkPreview.unchangedProfileIds.length > 0"
          >
            <h4>No-op profiles</h4>
            <p>{{ describeProfiles(bulkPreview.unchangedProfileIds) }}</p>
          </div>

          <div
            class="preview-list preview-list-wide"
            *ngIf="bulkPreview.permissionChangeSummary.length > 0"
          >
            <h4>Permission impact summary</h4>
            <div class="impact-chip-list">
              <div
                class="impact-chip"
                *ngFor="let change of bulkPreview.permissionChangeSummary"
                [attr.data-status]="change.status"
              >
                <strong>{{ change.permissionName }}</strong>
                <span>
                  {{ describePermissionStatus(change.status) }}
                  · {{ change.affectedProfileCount }} profile{{
                    change.affectedProfileCount === 1 ? '' : 's'
                  }}
                </span>
              </div>
            </div>
          </div>

          <div
            class="preview-list preview-list-wide"
            *ngIf="bulkPreview.profileImpacts.length > 0"
          >
            <h4>Why access changes</h4>
            <div
              class="profile-impact"
              *ngFor="let impact of bulkPreview.profileImpacts"
            >
              <strong>{{ getProfileDisplayName(impact.profileId) }}</strong>
              <div class="impact-chip-list">
                <div
                  class="impact-chip"
                  *ngFor="let change of impact.permissionChanges"
                  [attr.data-status]="change.status"
                >
                  <strong>{{ change.permissionName }}</strong>
                  <span>{{ describePermissionStatus(change.status) }}</span>
                  <small *ngIf="change.reason">{{ change.reason }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="bulk-preview-panel" *ngIf="lastBulkMutationResult">
        <div class="preview-grid">
          <div class="preview-metric">
            <span>Last mutation</span>
            <strong>
              {{
                lastBulkMutationResult.operation === 'assign'
                  ? 'Assignment'
                  : 'Removal'
              }}
            </strong>
          </div>
          <div class="preview-metric">
            <span>Completed</span>
            <strong>{{ lastBulkMutationResult.completedCount }}</strong>
          </div>
          <div class="preview-metric">
            <span>Scope</span>
            <strong>{{ lastBulkMutationResult.appScopeId }}</strong>
          </div>
          <div class="preview-metric">
            <span>Target</span>
            <strong>{{ lastBulkMutationResult.targetId || 'Global' }}</strong>
          </div>

          <div class="preview-list preview-list-wide">
            <h4>Audit summary</h4>
            <p>{{ buildAuditSummary(lastBulkMutationResult) }}</p>
          </div>
        </div>

        <div class="bulk-actions summary-actions">
          <otui-button
            variant="secondary"
            (action)="rollbackLastBulkMutation()"
            [disabled]="rollbackLoading || !canRollbackLastBulkMutation"
          >
            {{ rollbackLoading ? 'Reverting…' : rollbackActionLabel }}
          </otui-button>
        </div>
      </section>

      <section
        class="bulk-preview-panel"
        *ngIf="governanceAuditEntries.length > 0"
      >
        <div class="preview-list preview-list-wide">
          <h4>Governance audit history</h4>
          <div class="audit-history">
            <article
              class="audit-entry"
              *ngFor="let entry of governanceAuditEntries"
            >
              <strong>{{ entry.roleName }}</strong>
              <span>{{ entry.summary }}</span>
              <small>{{ entry.occurredAt | date : 'medium' }}</small>
            </article>
          </div>
        </div>
      </section>

      <app-ag-users-table
        [users]="users"
        [seededProfileIds]="seededUserIds"
        [telosSummaries]="telosSummaries"
        [loading]="loading"
        [selectionResetKey]="selectionResetKey"
        (manageRoles)="onManageRoles($event)"
        (selectionChange)="onSelectedUsersChange($event)"
        (manageTelos)="onManageTelos($event)"
      />
    </otui-card>

    <otui-modal
      *ngIf="showRoleModal"
      [heading]="roleModalHeading"
      (closeModal)="closeRoleModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="role-modal">
        <div class="role-panel">
          <h3>Assigned Roles</h3>
          <p class="panel-copy">
            Remove roles that should no longer apply to this profile.
          </p>

          <div *ngIf="roleManagementLoading" class="empty-state">
            Loading role assignments...
          </div>
          <div
            *ngIf="!roleManagementLoading && userRoles.length === 0"
            class="empty-state"
          >
            No role assignments found for this user.
          </div>

          <div
            class="role-list"
            *ngIf="!roleManagementLoading && userRoles.length > 0"
          >
            <div class="role-item" *ngFor="let assignment of userRoles">
              <div>
                <strong>{{
                  assignment.role?.name || assignment.roleId
                }}</strong>
                <p>
                  {{
                    assignment.role?.description || 'No description provided.'
                  }}
                </p>
                <span class="scope-chip">
                  {{ resolveAssignmentScopeLabel(assignment) }}
                </span>
              </div>
              <otui-button
                variant="danger"
                (action)="unassignRole(assignment)"
                [disabled]="roleMutationLoading"
              >
                Remove
              </otui-button>
            </div>
          </div>
        </div>

        <div class="role-panel">
          <h3>Available Roles</h3>
          <p class="panel-copy">
            Assign a role from the current catalog to this profile.
          </p>

          <div *ngIf="roleManagementLoading" class="empty-state">
            Loading available roles...
          </div>
          <div
            *ngIf="!roleManagementLoading && availableRoles.length === 0"
            class="empty-state"
          >
            No additional roles are available to assign.
          </div>

          <div
            class="role-list"
            *ngIf="!roleManagementLoading && availableRoles.length > 0"
          >
            <div class="role-item" *ngFor="let role of availableRoles">
              <div>
                <strong>{{ role.name }}</strong>
                <p>{{ role.description || 'No description provided.' }}</p>
                <span class="scope-chip">
                  {{ resolveRoleScopeLabel(role) }}
                </span>
              </div>
              <otui-button
                variant="primary"
                (action)="assignRole(role)"
                [disabled]="roleMutationLoading"
              >
                Assign
              </otui-button>
            </div>
          </div>
        </div>
      </div>
    </otui-modal>

    <otui-modal
      *ngIf="showTelosModal"
      [heading]="telosModalHeading"
      (closeModal)="closeTelosModal()"
      mode="standard-modal"
      size="lg"
    >
      <div class="telos-modal">
        <div class="telos-toolbar">
          <otui-button
            variant="primary"
            (action)="regenerateTelos()"
            [disabled]="telosMutationLoading || !selectedUser"
          >
            Rebuild
          </otui-button>
          <otui-button
            variant="danger"
            (action)="resetTelos()"
            [disabled]="telosMutationLoading || !selectedUser"
          >
            Reset Summary
          </otui-button>
        </div>

        <div *ngIf="telosLoading" class="empty-state">
          Loading TELOS data...
        </div>

        <div *ngIf="!telosLoading && !selectedUserTelos" class="empty-state">
          No TELOS document is currently available for this profile.
        </div>

        <ng-container *ngIf="!telosLoading && selectedUserTelos">
          <lib-character-sheet
            [enabled]="true"
            [skin]="'grounded'"
            [profileTelos]="selectedUserTelos"
          ></lib-character-sheet>

          <div class="telos-summary-grid">
            <div class="role-panel">
              <h3>Status</h3>
              <p>
                <strong>Generation:</strong>
                {{ selectedUserTelos.generationStatus }}
              </p>
              <p>
                <strong>Source facts:</strong>
                {{ selectedUserTelos.sourceCount }}
              </p>
              <p>
                <strong>Generated:</strong>
                {{ selectedUserTelos.generatedAt || 'Not generated yet' }}
              </p>
              <p>
                <strong>Updated from sources:</strong>
                {{ selectedUserTelos.sourceUpdatedAt || 'Unknown' }}
              </p>
            </div>

            <div class="role-panel">
              <h3>Summary</h3>
              <p>
                {{
                  selectedUserTelos.overallProfileSummary ||
                    'No summary generated yet.'
                }}
              </p>
            </div>
          </div>
        </ng-container>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }

      .bulk-governance-panel {
        display: grid;
        grid-template-columns: minmax(220px, 1.1fr) minmax(320px, 1.4fr);
        gap: 16px;
        margin: 16px 0;
        padding: 18px;
        border-radius: var(--personality-card-radius, 14px);
        border: var(--personality-border-width, 1px)
          var(--personality-border-style, solid)
          color-mix(
            in srgb,
            var(--border-color, #d6d6d6) 84%,
            var(--accent, #2563eb)
          );
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--surface, #ffffff) 90%, transparent),
          color-mix(
            in srgb,
            var(--accent, #2563eb) 10%,
            var(--surface, #ffffff)
          )
        );
        box-shadow: var(
          --personality-card-shadow,
          0 12px 28px rgba(0, 0, 0, 0.08)
        );
      }

      .bulk-governance-copy h3,
      .preview-list h4 {
        margin: 0 0 8px;
      }

      .bulk-governance-copy p {
        margin: 0;
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .selection-stat {
        display: inline-flex;
        margin-top: 14px;
        padding: 6px 10px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 14%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 84%,
          var(--foreground, #111827)
        );
        font-weight: 700;
      }

      .bulk-governance-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        align-items: end;
      }

      .control-field {
        display: grid;
        gap: 6px;
        font-weight: 600;
      }

      .control-field span {
        font-size: 0.9rem;
      }

      .control-field select {
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border-radius: var(--personality-input-radius, 10px);
        border: var(--personality-input-border-width, 1px) solid
          var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .control-field input {
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border-radius: var(--personality-input-radius, 10px);
        border: var(--personality-input-border-width, 1px) solid
          var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .bulk-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }

      .bulk-preview-panel {
        margin: 0 0 16px;
        padding: 16px;
        border-radius: var(--personality-card-radius, 12px);
        border: 1px solid
          color-mix(
            in srgb,
            var(--border-color, #d6d6d6) 86%,
            var(--accent, #2563eb)
          );
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 90%,
          var(--background, #f8fafc)
        );
      }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }

      .preview-metric,
      .preview-list {
        padding: 14px;
        border-radius: 12px;
        border: 1px solid
          color-mix(
            in srgb,
            var(--border-color, #d6d6d6) 86%,
            var(--accent, #2563eb)
          );
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--accent, #2563eb) 8%
        );
      }

      .preview-metric span {
        display: block;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: color-mix(in srgb, var(--foreground, #111827) 68%, transparent);
      }

      .preview-metric strong {
        display: block;
        margin-top: 8px;
        font-size: 1.35rem;
      }

      .preview-list p {
        margin: 0;
        color: color-mix(in srgb, var(--foreground, #111827) 74%, transparent);
      }

      .preview-list-wide {
        grid-column: 1 / -1;
      }

      .impact-chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .impact-chip {
        display: grid;
        gap: 4px;
        min-width: 180px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid
          color-mix(in srgb, var(--border-color, #d6d6d6) 86%, transparent);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f8fafc)
        );
      }

      .impact-chip span,
      .impact-chip small {
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .impact-chip[data-status='added'] {
        background: color-mix(
          in srgb,
          var(--success, #15803d) 12%,
          var(--surface, #ffffff)
        );
      }

      .impact-chip[data-status='removed'] {
        background: color-mix(
          in srgb,
          var(--danger, #b91c1c) 12%,
          var(--surface, #ffffff)
        );
      }

      .impact-chip[data-status='retained'],
      .impact-chip[data-status='already-present'] {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 10%,
          var(--surface, #ffffff)
        );
      }

      .profile-impact + .profile-impact {
        margin-top: 12px;
      }

      .summary-actions {
        margin-top: 14px;
        justify-content: flex-start;
      }

      .audit-history {
        display: grid;
        gap: 10px;
      }

      .audit-entry {
        display: grid;
        gap: 4px;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid
          color-mix(in srgb, var(--border-color, #d6d6d6) 86%, transparent);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          var(--background, #f8fafc)
        );
      }

      .preview-list-muted {
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 96%,
          var(--foreground, #111827) 4%
        );
      }

      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .seeded-summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 16px 0 8px;
      }

      .summary-card {
        display: grid;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        background: var(--background, #fff);
      }

      .summary-card span {
        color: var(--foreground-secondary, #666);
        font-size: 0.9rem;
      }

      .role-modal {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        padding: 12px;
      }

      .role-panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 12px;
        padding: 16px;
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .panel-copy {
        margin: 8px 0 16px;
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .role-list {
        display: grid;
        gap: 12px;
      }

      .role-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        padding: 12px;
      }

      .role-item p {
        margin: 4px 0 8px;
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .scope-chip {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 14%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
        font-size: 0.8rem;
        font-weight: 600;
      }

      .empty-state {
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .telos-modal {
        display: grid;
        gap: 16px;
        padding: 12px;
      }

      .telos-toolbar {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .telos-summary-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly governanceAuditService = inject(GovernanceAuditService);
  private readonly seededEmailDomain = '@example.com';

  users: ProfileDto[] = [];
  seededUserIds: string[] = [];
  telosSummaries: Record<string, ProfileTelosDto | null> = {};
  loading = false;
  rolesCatalog: RoleDto[] = [];
  showRoleModal = false;
  selectedUser: ProfileDto | null = null;
  selectedUsers: ProfileDto[] = [];
  roles: RoleDto[] = [];
  userRoles: UserRoleDto[] = [];
  availableRoles: RoleDto[] = [];
  roleManagementLoading = false;
  roleMutationLoading = false;
  bulkRoleId = '';
  bulkOperation: 'assign' | 'unassign' = 'assign';
  bulkPreview: BulkRoleMutationPreviewDto | null = null;
  bulkPreviewLoading = false;
  bulkMutationLoading = false;
  bulkTargetId = '';
  selectionResetKey = 0;
  lastBulkMutationPayload: BulkRoleMutationDto | null = null;
  lastBulkMutationResult: BulkRoleMutationResultDto | null = null;
  rollbackLoading = false;
  governanceAuditEntries: GovernanceAuditEntry[] = [];
  showTelosModal = false;
  selectedUserTelos: ProfileTelosDto | null = null;
  telosLoading = false;
  telosMutationLoading = false;
  seededBulkRebuildLoading = false;

  ngOnInit(): void {
    this.loadUsers();
    this.loadRolesCatalog();
    this.governanceAuditEntries = this.governanceAuditService.getEntries();
  }

  get seededCharacterSummaries(): Array<{
    profileId: string;
    profileName: string;
    classLabel: string;
    levelLabel: string;
    statusLabel: string;
  }> {
    return this.seededUserIds
      .map((profileId) => {
        const profile = this.users.find((entry) => entry.id === profileId);
        const telos = this.telosSummaries[profileId];
        if (!profile || !telos) {
          return null;
        }

        return {
          profileId,
          profileName: profile.profileName,
          classLabel: telos.characterSheet.classLabel,
          levelLabel:
            telos.generationStatus === 'ready'
              ? `Level ${telos.characterSheet.level}`
              : 'Awaiting rebuild',
          statusLabel: `Status: ${telos.generationStatus}`,
        };
      })
      .filter(
        (
          summary
        ): summary is {
          profileId: string;
          profileName: string;
          classLabel: string;
          levelLabel: string;
          statusLabel: string;
        } => summary !== null
      );
  }

  loadUsers(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.seededUserIds = users
          .filter((user) => this.isSeededUser(user))
          .map((user) => user.id);

        if (users.length === 0) {
          this.loading = false;
          this.messageService.addMessage({
            content: 'No users found in the system.',
            type: 'info',
          });
          return;
        }

        this.loadSeededTelosSummaries();
      },
      error: (err) => {
        this.loading = false;
        const errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to load users. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }

  onManageRoles(user: ProfileDto): void {
    this.selectedUser = user;
    this.showRoleModal = true;
    this.loadRoleManagementData(user.id);
  }

  onManageTelos(user: ProfileDto): void {
    this.selectedUser = user;
    this.showTelosModal = true;
    this.loadTelos(user.id);
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.selectedUser = null;
    this.roles = [];
    this.userRoles = [];
    this.availableRoles = [];
    this.roleManagementLoading = false;
    this.roleMutationLoading = false;
  }

  onSelectedUsersChange(users: ProfileDto[]): void {
    this.selectedUsers = users;
    this.resetBulkPreview();
  }

  onBulkRoleChange(roleId: string): void {
    this.bulkRoleId = roleId;
    this.resetBulkPreview();
  }

  onBulkOperationChange(operation: 'assign' | 'unassign'): void {
    this.bulkOperation = operation;
    this.resetBulkPreview();
  }

  onBulkTargetChange(targetId: string): void {
    this.bulkTargetId = targetId;
    this.resetBulkPreview();
  }

  closeTelosModal(): void {
    this.showTelosModal = false;
    this.selectedUser = null;
    this.selectedUserTelos = null;
    this.telosLoading = false;
    this.telosMutationLoading = false;
  }

  assignRole(role: RoleDto): void {
    if (!this.selectedUser) return;

    const appScopeId = this.resolveRoleScopeId(role);
    if (!appScopeId) {
      this.messageService.addMessage({
        content: `Cannot assign ${role.name} because it has no app scope.`,
        type: 'error',
      });
      return;
    }

    this.roleMutationLoading = true;

    this.rolesService
      .assignRole({
        roleId: role.id,
        profileId: this.selectedUser.id,
        appScopeId,
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: `Assigned ${role.name} to ${this.getSelectedUserName()}.`,
            type: 'success',
          });
          this.loadRoleManagementData(this.selectedUser!.id);
        },
        error: (err) => {
          this.roleMutationLoading = false;
          this.messageService.addMessage({
            content: err.error?.message || `Failed to assign ${role.name}.`,
            type: 'error',
          });
        },
      });
  }

  unassignRole(assignment: UserRoleDto): void {
    this.roleMutationLoading = true;

    this.rolesService.unassignRole(assignment.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: `Removed ${
            assignment.role?.name || 'role'
          } from ${this.getSelectedUserName()}.`,
          type: 'success',
        });
        if (this.selectedUser) {
          this.loadRoleManagementData(this.selectedUser.id);
        } else {
          this.roleMutationLoading = false;
        }
      },
      error: (err) => {
        this.roleMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to remove role assignment.',
          type: 'error',
        });
      },
    });
  }

  get roleModalHeading(): string {
    return this.selectedUser
      ? `Manage Roles: ${this.getSelectedUserName()}`
      : 'Manage Roles';
  }

  get telosModalHeading(): string {
    return this.selectedUser ? `TELOS: ${this.getSelectedUserName()}` : 'TELOS';
  }

  resolveRoleScopeLabel(role: RoleDto): string {
    return (
      role.appScope?.name || (role as any).appScopeId || 'Scope unavailable'
    );
  }

  resolveAssignmentScopeLabel(assignment: UserRoleDto): string {
    return (
      assignment.appScope?.name || assignment.appScopeId || 'Scope unavailable'
    );
  }

  regenerateTelos(): void {
    if (!this.selectedUser) return;

    this.telosMutationLoading = true;
    this.usersService.regenerateProfileTelos(this.selectedUser.id).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(this.selectedUser?.id, telos);
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: `Triggered TELOS rebuild for ${this.getSelectedUserName()}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to rebuild TELOS.',
          type: 'error',
        });
      },
    });
  }

  resetTelos(): void {
    if (!this.selectedUser) return;

    this.telosMutationLoading = true;
    this.usersService.resetProfileTelos(this.selectedUser.id).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(this.selectedUser?.id, telos);
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: `Reset derived TELOS summary for ${this.getSelectedUserName()}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.telosMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to reset TELOS summary.',
          type: 'error',
        });
      },
    });
  }

  rebuildSeededTelos(): void {
    if (this.seededUserIds.length === 0) {
      return;
    }

    this.seededBulkRebuildLoading = true;
    this.usersService.regenerateProfileTelosBulk(this.seededUserIds).subscribe({
      next: (documents) => {
        this.seededBulkRebuildLoading = false;
        documents.forEach((telos, index) => {
          this.updateTelosSummary(this.seededUserIds[index], telos);
        });
        this.messageService.addMessage({
          content: `Rebuilt TELOS for ${this.seededUserIds.length} seeded users.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.seededBulkRebuildLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message || 'Failed to rebuild seeded TELOS cohort.',
          type: 'error',
        });
      },
    });
  }

  get canPreviewBulkMutation(): boolean {
    return (
      this.selectedUsers.length > 0 &&
      !!this.bulkRoleId &&
      !this.bulkPreviewLoading &&
      !this.bulkMutationLoading
    );
  }

  get canExecuteBulkMutation(): boolean {
    return (
      !!this.bulkPreview &&
      this.bulkPreview.affectedCount > 0 &&
      !this.bulkPreviewLoading &&
      !this.bulkMutationLoading
    );
  }

  get bulkExecuteLabel(): string {
    return this.bulkOperation === 'assign'
      ? 'Apply Assignment'
      : 'Apply Removal';
  }

  get canRollbackLastBulkMutation(): boolean {
    return !!this.lastBulkMutationPayload && !this.rollbackLoading;
  }

  get rollbackActionLabel(): string {
    const operation = this.lastBulkMutationResult?.operation;
    return operation === 'assign'
      ? 'Rollback Assignment'
      : 'Restore Assignment';
  }

  previewBulkRoleMutation(): void {
    const payload = this.buildBulkRoleMutationPayload();
    if (!payload) {
      return;
    }

    this.bulkPreviewLoading = true;
    this.bulkPreview = null;
    this.messageService.clearMessages();

    this.rolesService.previewBulkRoleMutation(payload).subscribe({
      next: (preview) => {
        this.bulkPreview = preview;
        this.bulkPreviewLoading = false;
      },
      error: (err) => {
        this.bulkPreviewLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to preview the selected governance mutation.',
          type: 'error',
        });
      },
    });
  }

  executeBulkRoleMutation(): void {
    const payload = this.buildBulkRoleMutationPayload();
    if (!payload || !this.bulkPreview) {
      return;
    }

    this.bulkMutationLoading = true;
    this.messageService.clearMessages();

    this.rolesService.executeBulkRoleMutation(payload).subscribe({
      next: (result) => {
        this.bulkMutationLoading = false;
        this.lastBulkMutationPayload = payload;
        this.lastBulkMutationResult = result;
        this.recordGovernanceAudit({
          kind: 'bulk-role-mutation',
          operation: payload.operation,
          roleId: result.roleId,
          roleName: result.roleName,
          profileIds: payload.profileIds,
          appScopeId: result.appScopeId,
          targetId: result.targetId,
          summary: this.buildAuditSummary(result),
        });
        this.messageService.addMessage({
          content: `${
            this.bulkOperation === 'assign' ? 'Assigned' : 'Removed'
          } ${result.roleName} for ${result.completedCount} profile${
            result.completedCount === 1 ? '' : 's'
          }.`,
          type: 'success',
        });
        this.selectedUsers = [];
        this.bulkPreview = null;
        this.selectionResetKey += 1;
        if (
          this.selectedUser &&
          payload.profileIds.includes(this.selectedUser.id)
        ) {
          this.loadRoleManagementData(this.selectedUser.id);
        }
      },
      error: (err) => {
        this.bulkMutationLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to execute the selected governance mutation.',
          type: 'error',
        });
      },
    });
  }

  rollbackLastBulkMutation(): void {
    if (!this.lastBulkMutationPayload || !this.lastBulkMutationResult) {
      return;
    }

    const rollbackPayload: BulkRoleMutationDto = {
      ...this.lastBulkMutationPayload,
      operation:
        this.lastBulkMutationPayload.operation === 'assign'
          ? 'unassign'
          : 'assign',
    };

    this.rollbackLoading = true;

    this.rolesService.executeBulkRoleMutation(rollbackPayload).subscribe({
      next: (result) => {
        this.rollbackLoading = false;
        this.lastBulkMutationPayload = rollbackPayload;
        this.lastBulkMutationResult = result;
        this.recordGovernanceAudit({
          kind: 'bulk-role-mutation',
          operation: rollbackPayload.operation,
          roleId: result.roleId,
          roleName: result.roleName,
          profileIds: rollbackPayload.profileIds,
          appScopeId: result.appScopeId,
          targetId: result.targetId,
          summary: `Rollback applied. ${this.buildAuditSummary(result)}`,
        });
        this.messageService.addMessage({
          content: `Rollback applied for ${result.roleName} across ${
            result.completedCount
          } profile${result.completedCount === 1 ? '' : 's'}.`,
          type: 'success',
        });
      },
      error: (err) => {
        this.rollbackLoading = false;
        this.messageService.addMessage({
          content:
            err.error?.message ||
            'Failed to rollback the last governance mutation.',
          type: 'error',
        });
      },
    });
  }

  describeProfiles(profileIds: string[]): string {
    return profileIds
      .map((profileId) => this.getProfileLabel(profileId))
      .join(', ');
  }

  describePermissionStatus(
    status: BulkRoleMutationPermissionChangeDto['status']
  ): string {
    switch (status) {
      case 'added':
        return 'Will grant new access';
      case 'removed':
        return 'Will remove access';
      case 'retained':
        return 'Access remains through another role';
      case 'already-present':
        return 'Profile already had this access';
      default:
        return status;
    }
  }

  getProfileDisplayName(profileId: string): string {
    return this.getProfileLabel(profileId);
  }

  traceSelectedProfileAccess(): void {
    if (this.selectedUsers.length !== 1) {
      return;
    }

    this.router.navigate(['/dashboard/permissions-inspector'], {
      queryParams: {
        profileId: this.selectedUsers[0].id,
        source: 'users',
      },
    });
  }

  buildAuditSummary(result: BulkRoleMutationResultDto): string {
    return `${result.roleName} ${
      result.operation === 'assign' ? 'assignment' : 'removal'
    } completed for ${result.completedCount} of ${
      result.totalSelected
    } selected profiles in scope ${result.appScopeId}${
      result.targetId ? ` targeting ${result.targetId}` : ''
    }.`;
  }

  private loadRoleManagementData(profileId: string): void {
    this.roleManagementLoading = true;
    this.roleMutationLoading = false;
    this.messageService.clearMessages();

    forkJoin({
      roles: this.rolesService.getRoles(),
      userRoles: this.rolesService.getUserRoles(profileId),
    }).subscribe({
      next: ({ roles, userRoles }) => {
        const assignedRoleIds = new Set(
          userRoles.map((assignment) => assignment.roleId)
        );

        this.roles = roles;
        this.userRoles = userRoles;
        this.availableRoles = roles.filter(
          (role) => !assignedRoleIds.has(role.id)
        );
        this.roleManagementLoading = false;
      },
      error: (err) => {
        this.roleManagementLoading = false;
        this.roleMutationLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load role management data.',
          type: 'error',
        });
      },
    });
  }

  private resolveRoleScopeId(role: RoleDto): string | null {
    const appScope = role.appScope as { id?: string } | undefined;
    return appScope?.id || null;
  }

  private loadRolesCatalog(): void {
    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.rolesCatalog = roles;
      },
      error: () => {
        this.rolesCatalog = [];
      },
    });
  }

  private loadTelos(profileId: string): void {
    this.telosLoading = true;
    this.telosMutationLoading = false;
    this.selectedUserTelos = this.telosSummaries[profileId] || null;

    this.usersService.getProfileTelos(profileId).subscribe({
      next: (telos) => {
        this.selectedUserTelos = telos;
        this.updateTelosSummary(profileId, telos);
        this.telosLoading = false;
      },
      error: (err) => {
        this.telosLoading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load TELOS data.',
          type: 'error',
        });
      },
    });
  }

  private buildBulkRoleMutationPayload(): BulkRoleMutationDto | null {
    const selectedRole = this.rolesCatalog.find(
      (role) => role.id === this.bulkRoleId
    );
    const appScopeId = selectedRole
      ? this.resolveRoleScopeId(selectedRole)
      : null;

    if (!selectedRole || !appScopeId || this.selectedUsers.length === 0) {
      return null;
    }

    return {
      operation: this.bulkOperation,
      roleId: selectedRole.id,
      profileIds: this.selectedUsers.map((user) => user.id),
      appScopeId,
      targetId: this.bulkTargetId.trim() || undefined,
    } as const;
  }

  private getProfileLabel(profileId: string): string {
    const profile = this.users.find((user) => user.id === profileId);
    return profile?.profileName || profile?.userId || profileId;
  }

  private resetBulkPreview(): void {
    this.bulkPreview = null;
  }

  private recordGovernanceAudit(
    entry: Omit<GovernanceAuditEntry, 'id' | 'occurredAt'>
  ): void {
    this.governanceAuditService.recordEntry(entry);
    this.governanceAuditEntries = this.governanceAuditService.getEntries();
  }
  private getSelectedUserName(): string {
    return (
      this.selectedUser?.profileName || this.selectedUser?.id || 'selected user'
    );
  }

  private isSeededUser(user: ProfileDto): boolean {
    return !!user.email?.toLowerCase().endsWith(this.seededEmailDomain);
  }

  private loadSeededTelosSummaries(): void {
    if (this.seededUserIds.length === 0) {
      this.telosSummaries = {};
      this.loading = false;
      return;
    }

    forkJoin(
      this.seededUserIds.map((profileId) =>
        this.usersService.getProfileTelos(profileId)
      )
    ).subscribe({
      next: (documents) => {
        this.telosSummaries = documents.reduce<
          Record<string, ProfileTelosDto | null>
        >((acc, telos, index) => {
          acc[this.seededUserIds[index]] = telos;
          return acc;
        }, {});
        this.loading = false;
      },
      error: () => {
        this.telosSummaries = {};
        this.loading = false;
      },
    });
  }

  private updateTelosSummary(
    profileId: string | undefined,
    telos: ProfileTelosDto | null
  ): void {
    if (!profileId || !this.seededUserIds.includes(profileId)) {
      return;
    }

    this.telosSummaries = {
      ...this.telosSummaries,
      [profileId]: telos,
    };
  }
}
