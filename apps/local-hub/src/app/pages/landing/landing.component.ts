import { Component, inject, OnInit, signal } from '@angular/core';
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

  async ngOnInit(): Promise<void> {
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
