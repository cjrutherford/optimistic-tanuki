import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, TableRowAction, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
    MessageComponent,
  ],
  template: `
    <lib-message></lib-message>
    
    <otui-card>
      <otui-heading level="2">Users Management</otui-heading>

      <div *ngIf="loading" class="loading-message">Loading users...</div>

      <div *ngFor="let user of users" class="user-row">
        <otui-table
          [cells]="getUserCells(user)"
          [rowIndex]="users.indexOf(user)"
          [rowActions]="getUserActions(user)"
        ></otui-table>
      </div>
    </otui-card>
  `,
  styles: [
    `
      .loading-message {
        padding: 2rem;
        text-align: center;
      }

      .user-row {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  users: ProfileDto[] = [];
  loading = false;

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
        
        if (users.length === 0) {
          this.messageService.addMessage({
            content: 'No users found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load users. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }

  getUserCells(user: ProfileDto): TableCell[] {
    return [
      { heading: 'Name', value: user.profileName },
      { heading: 'User ID', value: user.userId, isOverflowable: true },
      { heading: 'Bio', value: user.bio || 'N/A' },
    ];
  }

  getUserActions(user: ProfileDto): TableRowAction[] {
    return [
      {
        title: 'Manage Roles',
        action: async (index: number) => {
          console.log('Manage roles for user:', user);
          // TODO: Implement role management dialog
        },
      },
    ];
  }
}
