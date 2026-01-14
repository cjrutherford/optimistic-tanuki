import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import {
  MessageComponent,
  MessageService,
} from '@optimistic-tanuki/message-ui';
import { RoleDto } from '@optimistic-tanuki/ui-models';
import { RolesService } from '../services/roles.service';
import { AgRolesTableComponent } from './ag-roles-table.component';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    HeadingComponent,
    MessageComponent,
    AgRolesTableComponent,
  ],
  template: `
    <lib-message></lib-message>

    <otui-card>
      <otui-heading level="2">Roles Management</otui-heading>

      <app-ag-roles-table [roles]="roles" [loading]="loading" />
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
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage =
          err.error?.message ||
          err.message ||
          'Failed to load roles. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error',
        });
      },
    });
  }
}
