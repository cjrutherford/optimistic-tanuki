import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { RoleDto } from '@optimistic-tanuki/ui-models';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-roles-management',
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
      <otui-heading level="2">Roles Management</otui-heading>

      <div *ngIf="loading" class="loading-message">Loading roles...</div>

      <div *ngFor="let role of roles" class="role-row">
        <otui-table
          [cells]="getRoleCells(role)"
          [rowIndex]="roles.indexOf(role)"
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

      .role-row {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class RolesManagementComponent implements OnInit {
  roles: RoleDto[] = [];
  loading = false;

  constructor(
    private rolesService: RolesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.messageService.clearMessages();
    
    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
        
        if (roles.length === 0) {
          this.messageService.addMessage({
            content: 'No roles found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load roles. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }

  getRoleCells(role: RoleDto): TableCell[] {
    return [
      { heading: 'Name', value: role.name },
      { heading: 'Description', value: role.description },
      { heading: 'App Scope', value: role.appScope?.name || 'N/A' },
    ];
  }
}
