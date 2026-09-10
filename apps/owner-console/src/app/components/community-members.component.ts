import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  CommunityMemberDto,
  CommunityMemberRole,
  InviteToCommunityDto,
} from '@optimistic-tanuki/ui-models';
import {
  CommunityManagerRecord,
  CommunityMembershipAuditRecord,
  CommunityService,
} from '../services/community.service';

type CommunityLifecycleState = 'pending' | 'active' | 'suspended' | 'revoked';
type CommunityLifecycleAction = 'suspend' | 'reactivate';

@Component({
  selector: 'app-community-members',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
    TextInputComponent,
    ModalComponent,
  ],
  templateUrl: './community-members.component.html',
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }
      .members-table {
        width: 100%;
        border-collapse: collapse;
      }
      .members-table th,
      .members-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }
      .members-table th {
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f3f4f6)
        );
      }
      .member-actions {
        display: flex;
        gap: 8px;
      }
      .role-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      .role-owner {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 22%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }
      .role-admin {
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 22%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
      }
      .role-moderator {
        background: color-mix(
          in srgb,
          var(--info, #0ea5e9) 22%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--info, #0ea5e9) 82%,
          var(--foreground, #111827)
        );
      }
      .role-member {
        background: color-mix(
          in srgb,
          var(--foreground, #111827) 18%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--foreground, #111827) 82%,
          var(--surface, #ffffff)
        );
      }
      .lifecycle-pending {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 18%,
          var(--surface, #ffffff)
        );
      }
      .lifecycle-active {
        background: color-mix(
          in srgb,
          var(--success, #15803d) 18%,
          var(--surface, #ffffff)
        );
      }
      .lifecycle-suspended,
      .lifecycle-revoked {
        background: color-mix(
          in srgb,
          var(--danger, #b91c1c) 18%,
          var(--surface, #ffffff)
        );
      }
      .audit-reference {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        color: var(--muted-foreground, #4b5563);
        font-size: 12px;
      }
      .manager-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f3f4f6)
        );
      }
    `,
  ],
})
export class CommunityMembersComponent implements OnInit {
  communityId: string = '';
  members: CommunityMemberDto[] = [];
  currentManager: CommunityManagerRecord | null = null;
  loading = false;
  showAddMemberModal = false;
  inviteForm: FormGroup;
  inviting = false;
  auditMemberId: string | null = null;
  membershipAudit: CommunityMembershipAuditRecord[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private communityService: CommunityService,
    private messageService: MessageService
  ) {
    this.inviteForm = this.fb.group({
      inviteeUserId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id') || '';
    if (this.communityId) {
      this.loadMembers();
    }
  }

  loadMembers(): void {
    this.loading = true;
    this.communityService.getCommunityMembers(this.communityId).subscribe({
      next: (members) => {
        this.members = members;
        this.loadManager();
      },
      error: (err) => {
        this.loading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load members.',
          type: 'error',
        });
      },
    });
  }

  loadManager(): void {
    this.communityService.getCommunityManager(this.communityId).subscribe({
      next: (manager) => {
        this.currentManager = manager;
        this.loading = false;
      },
      error: (err) => {
        this.currentManager = null;
        this.loading = false;
        if (err?.status !== 404) {
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to load community manager.',
            type: 'error',
          });
        }
      },
    });
  }

  updateRole(member: CommunityMemberDto, role: string): void {
    this.communityService
      .updateMemberRole(
        this.communityId,
        member.id,
        role as CommunityMemberRole
      )
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Role updated successfully.',
            type: 'success',
          });
          this.loadMembers();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to update role.',
            type: 'error',
          });
        },
      });
  }

  removeMember(member: CommunityMemberDto): void {
    if (confirm(`Remove ${member.profileId} from community?`)) {
      this.communityService
        .removeMember(this.communityId, member.id)
        .subscribe({
          next: () => {
            this.messageService.addMessage({
              content: 'Member removed successfully.',
              type: 'success',
            });
            this.loadMembers();
          },
          error: (err) => {
            this.messageService.addMessage({
              content: err.error?.message || 'Failed to remove member.',
              type: 'error',
            });
          },
        });
    }
  }

  getLifecycleState(
    member: Pick<CommunityMemberDto, 'status'>
  ): CommunityLifecycleState {
    switch (String(member.status).toLowerCase()) {
      case 'pending':
        return 'pending';
      case 'suspended':
        return 'suspended';
      case 'revoked':
      case 'rejected':
        return 'revoked';
      case 'approved':
      default:
        return 'active';
    }
  }

  getLifecycleAction(
    member: Pick<CommunityMemberDto, 'status'> &
      Partial<Pick<CommunityMemberDto, 'role' | 'profileId'>>
  ): CommunityLifecycleAction | null {
    if (
      String(member.role).toLowerCase() === 'owner' ||
      String(member.role).toLowerCase() === 'manager' ||
      this.isCurrentManager(member)
    ) {
      return null;
    }

    switch (this.getLifecycleState(member)) {
      case 'active':
        return 'suspend';
      case 'suspended':
        return 'reactivate';
      default:
        return null;
    }
  }

  suspendMember(
    member: Pick<CommunityMemberDto, 'id' | 'status' | 'profileId'>
  ): void {
    if (this.getLifecycleAction(member) !== 'suspend') {
      return;
    }

    this.communityService.suspendMember(this.communityId, member.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Member suspended successfully.',
          type: 'success',
        });
        this.loadMembers();
      },
      error: (err) => {
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to suspend member.',
          type: 'error',
        });
      },
    });
  }

  reactivateMember(
    member: Pick<CommunityMemberDto, 'id' | 'status' | 'profileId'>
  ): void {
    if (this.getLifecycleAction(member) !== 'reactivate') {
      return;
    }

    this.communityService
      .reactivateMember(this.communityId, member.id)
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Member reactivated successfully.',
            type: 'success',
          });
          this.loadMembers();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to reactivate member.',
            type: 'error',
          });
        },
      });
  }

  viewMembershipAudit(member: Pick<CommunityMemberDto, 'id'>): void {
    this.communityService
      .getMembershipAudit(this.communityId, member.id)
      .subscribe({
        next: (audit) => {
          this.auditMemberId = member.id;
          this.membershipAudit = audit;
        },
        error: (err) => {
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to load membership audit.',
            type: 'error',
          });
        },
      });
  }

  isAuditVisible(member: Pick<CommunityMemberDto, 'id'>): boolean {
    return this.auditMemberId === member.id;
  }

  appointManager(
    member: Pick<CommunityMemberDto, 'userId' | 'profileId'>
  ): void {
    this.communityService
      .appointManager(this.communityId, {
        userId: member.userId,
        profileId: member.profileId,
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Community manager appointed successfully.',
            type: 'success',
          });
          this.loadMembers();
        },
        error: (err) => {
          this.messageService.addMessage({
            content:
              err.error?.message || 'Failed to appoint community manager.',
            type: 'error',
          });
        },
      });
  }

  revokeManager(): void {
    this.communityService.revokeManager(this.communityId).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Community manager revoked successfully.',
          type: 'success',
        });
        this.loadMembers();
      },
      error: (err) => {
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to revoke community manager.',
          type: 'error',
        });
      },
    });
  }

  openAddMemberModal(): void {
    this.showAddMemberModal = true;
    this.inviteForm.reset();
  }

  closeAddMemberModal(): void {
    this.showAddMemberModal = false;
  }

  inviteMember(): void {
    if (this.inviteForm.invalid) {
      this.messageService.addMessage({
        content: 'Please enter a user ID to invite.',
        type: 'error',
      });
      return;
    }

    this.inviting = true;
    const inviteData: InviteToCommunityDto = {
      communityId: this.communityId,
      inviteeUserId: this.inviteForm.value.inviteeUserId,
    };

    this.communityService.inviteMember(inviteData).subscribe({
      next: () => {
        this.inviting = false;
        this.messageService.addMessage({
          content: 'Member invited successfully.',
          type: 'success',
        });
        this.closeAddMemberModal();
        this.loadMembers();
      },
      error: (err) => {
        this.inviting = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to invite member.',
          type: 'error',
        });
      },
    });
  }

  back(): void {
    this.router.navigate(['/dashboard/communities', this.communityId]);
  }

  getRoleClass(role: CommunityMemberRole): string {
    return `role-${role.toLowerCase()}`;
  }

  isCurrentManager(
    member: Partial<Pick<CommunityMemberDto, 'profileId'>>
  ): boolean {
    return Boolean(
      member.profileId && this.currentManager?.profileId === member.profileId
    );
  }
}
