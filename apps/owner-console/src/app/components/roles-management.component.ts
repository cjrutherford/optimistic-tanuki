import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { RolesService, Role } from '../services/roles.service';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
  ],
  template: `
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
  roles: Role[] = [];
  loading = false;

  constructor(private rolesService: RolesService) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getRoleCells(role: Role): TableCell[] {
    return [
      { heading: 'Name', value: role.name },
      { heading: 'Description', value: role.description },
      { heading: 'App Scope', value: role.appScope?.name || 'N/A' },
    ];
  }
}
