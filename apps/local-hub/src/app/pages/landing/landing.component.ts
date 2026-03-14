import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);

  cities = signal<City[]>([]);
  communities = signal<LocalCommunity[]>([]);
  loading = signal(true);

  totalCities = signal(0);
  totalCommunities = signal(0);
  totalMembers = signal(0);

  async ngOnInit(): Promise<void> {
    try {
      const [citiesData, communitiesData] = await Promise.all([
        this.communityService.getCities(),
        this.communityService.getMockCommunities(),
      ]);

      this.cities.set(citiesData);
      this.communities.set(communitiesData);

      this.totalCities.set(citiesData.length);
      this.totalCommunities.set(communitiesData.length);

      const totalMembers = communitiesData.reduce(
        (sum, c) => sum + (c.memberCount || 0),
        0
      );
      this.totalMembers.set(totalMembers);
    } catch (error) {
      console.error('Failed to load landing data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  navigateToCommunities(): void {
    this.router.navigate(['/communities']);
  }

  navigateToCities(): void {
    this.router.navigate(['/cities']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }

  navigateToCity(slug: string): void {
    this.router.navigate(['/city', slug]);
  }
}
