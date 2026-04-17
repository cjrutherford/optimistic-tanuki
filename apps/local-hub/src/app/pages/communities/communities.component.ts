import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';

type LocalityType = 'all' | 'city' | 'town' | 'neighborhood';

interface FilterState {
  searchQuery: string;
  states: string[];
  localityTypes: LocalityType[];
}

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
  selectedStates = signal<string[]>([]);
  selectedLocalityTypes = signal<LocalityType[]>('all' as any);

  states = ['GA', 'SC', 'FL', 'NC'];
  localityTypes: { value: LocalityType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'city', label: 'Cities' },
    { value: 'town', label: 'Towns' },
    { value: 'neighborhood', label: 'Neighborhoods' },
  ];

  get filteredCommunities(): LocalCommunity[] {
    let results = this.communities();

    const q = this.searchQuery().toLowerCase();
    if (q) {
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.adminArea.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    const states = this.selectedStates();
    if (states.length > 0) {
      results = results.filter((c) => states.includes(c.adminArea));
    }

    const types = this.selectedLocalityTypes();
    if (types && types.length > 0 && !types.includes('all' as any)) {
      results = results.filter((c) => types.includes(c.localityType as any));
    }

    return results;
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.searchQuery()) count++;
    if (this.selectedStates().length > 0) count++;
    const types = this.selectedLocalityTypes();
    if (types && types.length > 0 && !types.includes('all' as any)) count++;
    return count;
  }

  async ngOnInit(): Promise<void> {
    try {
      const communities = await this.communityService.getCommunities();
      const nonCityCommunities = communities.filter(
        (c) => !c.localityType || c.localityType !== 'city'
      );
      this.communities.set(nonCityCommunities);
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

  toggleState(state: string): void {
    const current = this.selectedStates();
    if (current.includes(state)) {
      this.selectedStates.set(current.filter((s) => s !== state));
    } else {
      this.selectedStates.set([...current, state]);
    }
  }

  setLocalityType(type: LocalityType): void {
    this.selectedLocalityTypes.set([type]);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStates.set([]);
    this.selectedLocalityTypes.set(['all'] as any);
  }

  removeStateFilter(state: string): void {
    this.selectedStates.set(this.selectedStates().filter((s) => s !== state));
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }
}
