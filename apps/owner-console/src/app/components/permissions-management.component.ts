import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { PermissionDto } from '@optimistic-tanuki/ui-models';
import { PermissionsService } from '../services/permissions.service';

@Component({
  selector: 'app-permissions-management',
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
      <otui-heading level="2">Permissions Management</otui-heading>

      <div *ngIf="loading" class="loading-message">Loading permissions...</div>

      <div *ngFor="let perm of permissions" class="perm-row">
        <otui-table
          [cells]="getPermissionCells(perm)"
          [rowIndex]="permissions.indexOf(perm)"
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

      .perm-row {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class PermissionsManagementComponent implements OnInit {
  permissions: PermissionDto[] = [];
  loading = false;

  constructor(
    private permissionsService: PermissionsService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading = true;
    this.messageService.clearMessages();
    
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.loading = false;
        
        if (permissions.length === 0) {
          this.messageService.addMessage({
            content: 'No permissions found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load permissions. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }

  getPermissionCells(perm: PermissionDto): TableCell[] {
    return [
      { heading: 'Name', value: perm.name },
      { heading: 'Description', value: perm.description },
      { heading: 'Resource', value: perm.resource },
      { heading: 'Action', value: perm.action },
    ];
  }
}
