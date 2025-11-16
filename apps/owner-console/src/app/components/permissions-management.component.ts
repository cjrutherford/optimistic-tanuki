import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { PermissionsService, Permission } from '../services/permissions.service';

@Component({
  selector: 'app-permissions-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
  ],
  template: `
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
  permissions: Permission[] = [];
  loading = false;

  constructor(private permissionsService: PermissionsService) {}

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading = true;
    this.permissionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getPermissionCells(perm: Permission): TableCell[] {
    return [
      { heading: 'Name', value: perm.name },
      { heading: 'Description', value: perm.description },
      { heading: 'Resource', value: perm.resource },
      { heading: 'Action', value: perm.action },
    ];
  }
}
