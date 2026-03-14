import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './communities.component.html',
  styleUrls: ['./communities.component.scss'],
})
export class CommunitiesComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);

  communities = signal<LocalCommunity[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  searchQuery = signal('');

  get filteredCommunities(): LocalCommunity[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.communities();
    return this.communities().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.adminArea.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.communityService.getMockCommunitiesForCity('');
      if (data.length === 0) {
        const communities = await this.communityService.getMockCommunities();
        this.communities.set(communities);
      } else {
        this.communities.set(data);
      }
    } catch {
      this.error.set('Unable to load communities. Please try again later.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }
}
