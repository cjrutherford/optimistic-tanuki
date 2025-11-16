import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { AppScopesService, AppScope } from '../services/app-scopes.service';

@Component({
  selector: 'app-app-scopes-management',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    TableComponent,
    HeadingComponent,
  ],
  template: `
    <otui-card>
      <otui-heading level="2">App Scopes Management</otui-heading>

      <div *ngIf="loading" class="loading-message">Loading app scopes...</div>

      <div *ngFor="let scope of appScopes" class="scope-row">
        <otui-table
          [cells]="getAppScopeCells(scope)"
          [rowIndex]="appScopes.indexOf(scope)"
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

      .scope-row {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class AppScopesManagementComponent implements OnInit {
  appScopes: AppScope[] = [];
  loading = false;

  constructor(private appScopesService: AppScopesService) {}

  ngOnInit(): void {
    this.loadAppScopes();
  }

  loadAppScopes(): void {
    this.loading = true;
    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = appScopes;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getAppScopeCells(scope: AppScope): TableCell[] {
    return [
      { heading: 'Name', value: scope.name },
      { heading: 'Description', value: scope.description },
      { heading: 'Status', value: scope.active ? 'Active' : 'Inactive', isBadge: true },
    ];
  }
}
