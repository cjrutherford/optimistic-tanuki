import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, TableRowAction, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { UsersService, Profile } from '../services/users.service';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
  ],
  template: `
    <otui-card>
      <otui-heading level="2">Users Management</otui-heading>

      <div *ngIf="loading" class="loading-message">Loading users...</div>
      <div *ngIf="!loading && error" class="error-message">{{ error }}</div>

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

      .error-message {
        color: #f44336;
        padding: 1rem;
        text-align: center;
      }

      .user-row {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class UsersManagementComponent implements OnInit {
  users: Profile[] = [];
  loading = false;
  error = '';

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';

    this.usersService.getProfiles().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load users';
        this.loading = false;
      },
    });
  }

  getUserCells(user: Profile): TableCell[] {
    return [
      { heading: 'Name', value: user.name },
      { heading: 'User ID', value: user.userId, isOverflowable: true },
      { heading: 'Bio', value: user.bio || 'N/A' },
    ];
  }

  getUserActions(user: Profile): TableRowAction[] {
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
