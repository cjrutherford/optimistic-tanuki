import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  OwnerConfirmService,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
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
    ButtonComponent,
    OwnerFilterBarComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './community-management.component.html',
  styleUrls: ['./community-management.component.scss'],
})
export class CommunityManagementComponent implements OnInit {
  communities: CommunityDto[] = [];
  filteredCommunities: CommunityDto[] = [];
  loading = false;
  /** Set when the list could not be loaded; shows Unavailable + Retry. */
  loadError = '';

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

  private readonly confirmService = inject(OwnerConfirmService);

  ngOnInit(): void {
    this.loadCommunities();
  }

  loadCommunities(): void {
    this.loading = true;
    this.loadError = '';
    this.messageService.clearMessages();

    this.communityService.getCommunities().subscribe({
      next: (communities) => {
        this.communities = Array.isArray(communities) ? communities : [];
        this.applyFiltersAndSort();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.communities = [];
        this.filteredCommunities = [];
        this.loadError = err?.error?.message || 'Failed to load communities.';
      },
    });
  }

  /** The card summary: the first 100 characters, safe when a record has none. */
  blurb(description: string | null | undefined): string {
    const text = description ?? '';
    return text.length > 100 ? `${text.slice(0, 100)}...` : text;
  }

  applyFiltersAndSort(): void {
    let result = [...this.communities];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(query) ||
          (c.description ?? '').toLowerCase().includes(query)
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

  onSearch(query: string): void {
    this.searchQuery = query;
    this.applyFiltersAndSort();
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

  async deleteCommunity(community: CommunityDto, event?: Event): Promise<void> {
    event?.stopPropagation?.();
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Delete this community',
      body: `Deleting ${community.name} cannot be undone. Its members lose the community.`,
      confirmLabel: 'Delete community',
      typedPhrase: community.name || community.id,
      destructive: true,
    });
    if (!result.confirmed) return;
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
