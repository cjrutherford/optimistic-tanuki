import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui/heading/heading.component';
import { MessageComponent } from '@optimistic-tanuki/message-ui/message/message.component';
import { MessageService } from '@optimistic-tanuki/message-ui/message.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { AgUsersTableComponent } from './ag-users-table.component';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    HeadingComponent,
    MessageComponent,
    AgUsersTableComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <otui-heading level="2">Users Management</otui-heading>

      <app-ag-users-table
        [users]="users"
        [loading]="loading"
        (manageRoles)="onManageRoles($event)"
      />
    </otui-card>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly messageService = inject(MessageService);

  users: ProfileDto[] = [];
  loading = false;

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
            type: 'info',
          });
        }
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
    console.log('Manage roles for user:', user);
    // TODO: Implement role management dialog
    this.messageService.addMessage({
      content: `Role management for ${user.profileName} is not yet implemented.`,
      type: 'info',
    });
  }
}
