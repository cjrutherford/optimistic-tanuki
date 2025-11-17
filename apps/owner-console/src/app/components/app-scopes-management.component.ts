import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, TableComponent, TableCell, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';
import { AppScopeDto } from '@optimistic-tanuki/ui-models';
import { AppScopesService } from '../services/app-scopes.service';

@Component({
  selector: 'app-app-scopes-management',
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
  appScopes: AppScopeDto[] = [];
  loading = false;

  constructor(
    private appScopesService: AppScopesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadAppScopes();
  }

  loadAppScopes(): void {
    this.loading = true;
    this.messageService.clearMessages();
    
    this.appScopesService.getAppScopes().subscribe({
      next: (appScopes) => {
        this.appScopes = appScopes;
        this.loading = false;
        
        if (appScopes.length === 0) {
          this.messageService.addMessage({
            content: 'No app scopes found in the system.',
            type: 'info'
          });
        }
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.message || err.message || 'Failed to load app scopes. Please try again.';
        this.messageService.addMessage({
          content: errorMessage,
          type: 'error'
        });
      },
    });
  }

  getAppScopeCells(scope: AppScopeDto): TableCell[] {
    return [
      { heading: 'Name', value: scope.name },
      { heading: 'Description', value: scope.description },
      { heading: 'Status', value: scope.active ? 'Active' : 'Inactive', isBadge: true },
    ];
  }
}
