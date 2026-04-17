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
import { CommunityService } from '../services/community.service';

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
        background: var(--bg-secondary);
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
        background: gold;
        color: black;
      }
      .role-admin {
        background: purple;
        color: white;
      }
      .role-moderator {
        background: blue;
        color: white;
      }
      .role-member {
        background: gray;
        color: white;
      }
    `,
  ],
})
export class CommunityMembersComponent implements OnInit {
  communityId: string = '';
  members: CommunityMemberDto[] = [];
  loading = false;
  showAddMemberModal = false;
  inviteForm: FormGroup;
  inviting = false;

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
        this.loading = false;
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
}
