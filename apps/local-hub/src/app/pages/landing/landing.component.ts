import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';
import { DonationProgressComponent } from '../../components/donation-progress/donation-progress.component';
import { PaymentService, DonationGoal } from '../../services/payment.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, DonationProgressComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private paymentService = inject(PaymentService);

  cities = signal<City[]>([]);
  communities = signal<LocalCommunity[]>([]);
  loading = signal(true);
  donationGoal = signal<DonationGoal | null>(null);

  totalCities = signal(0);
  totalCommunities = signal(0);
  totalMembers = signal(0);
  currentCityIndex = signal(0);
  visibleCityCount = signal(2);

  async ngOnInit(): Promise<void> {
    this.updateVisibleCityCount();

    try {
      // Fetch communities once and derive cities from that list to avoid a
      // redundant second HTTP request (getCities() calls getCommunities() internally).
      const [communitiesData, goalData] = await Promise.all([
        this.communityService.getCommunities(),
        this.paymentService.getDonationGoal(),
      ]);

      const citiesData =
        this.communityService.getCitiesFromCommunities(communitiesData);

      this.cities.set(citiesData);
      this.communities.set(communitiesData);
      this.donationGoal.set(goalData);

      this.totalCities.set(citiesData.length);
      this.totalCommunities.set(communitiesData.length);

      const totalMembers = communitiesData.reduce(
        (sum: number, c: { memberCount?: number }) =>
          sum + (c.memberCount || 0),
        0
      );
      this.totalMembers.set(totalMembers);
      this.clampCityIndex();
    } catch (error) {
      console.error('Failed to load landing data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateVisibleCityCount();
  }

  get visibleCities(): City[] {
    const cities = this.cities();
    const visibleCityCount = this.visibleCityCount();

    if (cities.length <= visibleCityCount) {
      return cities;
    }

    const start = this.currentCityIndex();
    return cities.slice(start, start + visibleCityCount);
  }

  get canScrollCitiesBackward(): boolean {
    return this.currentCityIndex() > 0;
  }

  get canScrollCitiesForward(): boolean {
    return this.currentCityIndex() < this.getMaxCityIndex();
  }

  scrollCities(direction: 'previous' | 'next'): void {
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = this.currentCityIndex() + delta;

    this.currentCityIndex.set(
      Math.min(Math.max(nextIndex, 0), this.getMaxCityIndex())
    );
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

  private updateVisibleCityCount(): void {
    if (typeof window === 'undefined') {
      this.visibleCityCount.set(2);
      this.clampCityIndex();
      return;
    }

    if (window.innerWidth < 640) {
      this.visibleCityCount.set(1);
    } else if (window.innerWidth < 1200) {
      this.visibleCityCount.set(2);
    } else {
      this.visibleCityCount.set(3);
    }

    this.clampCityIndex();
  }

  private getMaxCityIndex(): number {
    return Math.max(this.cities().length - this.visibleCityCount(), 0);
  }

  private clampCityIndex(): void {
    this.currentCityIndex.set(
      Math.min(this.currentCityIndex(), this.getMaxCityIndex())
    );
  }
}
