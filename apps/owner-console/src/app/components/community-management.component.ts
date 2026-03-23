import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  CommunityDto,
  CommunityJoinPolicy,
} from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-community-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
  ],
  templateUrl: './community-management.component.html',
  styles: [
    `
      :host {
        display: block;
        padding: var(--spacing-md);
      }
      .filters {
        display: flex;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);
        flex-wrap: wrap;
        align-items: center;
      }
      .search-input {
        flex: 1;
        min-width: 200px;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .search-input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(63, 81, 181, 0.2);
      }
      .filter-select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .community-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: var(--spacing-md);
        margin-top: var(--spacing-md);
      }
      .community-card {
        padding: var(--spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-md);
        background: var(--surface);
        cursor: pointer;
        transition: box-shadow 0.2s, transform 0.2s;
      }
      .community-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
      .community-card h3 {
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--text-primary);
      }
      .community-card p {
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--text-secondary);
      }
      .community-card .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--border-radius-sm);
        font-size: 12px;
        background: var(--accent);
        color: white;
      }
      .community-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
      }
      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--text-secondary);
      }
      .sortable {
        cursor: pointer;
        user-select: none;
      }
      .sortable:hover {
        color: var(--accent);
      }
      .loading-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--text-secondary);
      }
    `,
  ],
})
export class CommunityManagementComponent implements OnInit {
  communities: CommunityDto[] = [];
  filteredCommunities: CommunityDto[] = [];
  loading = false;

  searchQuery = '';
  sortBy: 'name' | 'memberCount' | 'createdAt' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  filterJoinPolicy: string = '';

  joinPolicyOptions = [
    { value: '', label: 'All Policies' },
    { value: CommunityJoinPolicy.PUBLIC, label: 'Public' },
    {
      value: CommunityJoinPolicy.APPROVAL_REQUIRED,
      label: 'Approval Required',
    },
    { value: CommunityJoinPolicy.INVITE_ONLY, label: 'Invite Only' },
  ];

  constructor(
    private communityService: CommunityService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadCommunities();
  }

  loadCommunities(): void {
    this.loading = true;
    this.messageService.clearMessages();

    this.communityService.getCommunities().subscribe({
      next: (communities) => {
        this.communities = communities;
        this.applyFiltersAndSort();
        this.loading = false;
        if (communities.length === 0) {
          this.messageService.addMessage({
            content: 'No communities found.',
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load communities.',
          type: 'error',
        });
      },
    });
  }

  applyFiltersAndSort(): void {
    let result = [...this.communities];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    if (this.filterJoinPolicy) {
      result = result.filter((c) => c.joinPolicy === this.filterJoinPolicy);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (this.sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (this.sortBy === 'memberCount') {
        comparison = (a.memberCount || 0) - (b.memberCount || 0);
      } else if (this.sortBy === 'createdAt') {
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.filteredCommunities = result;
  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }

  onSortChange(column: 'name' | 'memberCount' | 'createdAt'): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  createNew(): void {
    this.router.navigate(['/dashboard/communities/new']);
  }

  editCommunity(community: CommunityDto): void {
    this.router.navigate(['/dashboard/communities', community.id]);
  }

  manageMembers(community: CommunityDto): void {
    this.router.navigate(['/dashboard/communities', community.id, 'members']);
  }

  deleteCommunity(community: CommunityDto, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${community.name}"?`)) {
      this.communityService.deleteCommunity(community.id).subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Community deleted successfully.',
            type: 'success',
          });
          this.loadCommunities();
        },
        error: (err) => {
          this.messageService.addMessage({
            content: err.error?.message || 'Failed to delete community.',
            type: 'error',
          });
        },
      });
    }
  }
}
