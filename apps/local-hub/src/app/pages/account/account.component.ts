import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../../services/auth-state.service';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PersonalitySelectorComponent } from '@optimistic-tanuki/theme-ui';

import { DaylightAccountComponent } from '../../components/daylight-account/daylight-account.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    PersonalitySelectorComponent,
    DaylightAccountComponent,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private authState = inject(AuthStateService);
  private communityService = inject(CommunityService);
  private messageService = inject(MessageService);
  private profiles = inject(ProfileAPIService);
  readonly router = inject(Router);

  myCommunities = signal<LocalCommunity[]>([]);
  loadingCommunities = signal(true);
  currentProfile = signal<ProfileDto | null>(null);
  loadingProfile = signal(true);
  leavingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMyCommunities();
    this.loadCurrentProfile();
  }

  async loadMyCommunities(): Promise<void> {
    try {
      const communities = await this.communityService.getMyMemberships();
      this.myCommunities.set(communities);
    } catch {
      // non-fatal — user may not be a member of any community yet
    } finally {
      this.loadingCommunities.set(false);
    }
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  async loadCurrentProfile(): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.profiles.profileControllerGetCurrentProfile<ProfileDto>()
      );
      this.currentProfile.set(profile);
    } catch {
      // non-fatal — profile section simply stays hidden
      this.currentProfile.set(null);
    } finally {
      this.loadingProfile.set(false);
    }
  }

  viewMyProfile(): void {
    const profile = this.currentProfile();
    if (profile) {
      this.router.navigate(['/profile', profile.id]);
    }
  }

  async leaveCommunity(community: LocalCommunity): Promise<void> {
    this.leavingId.set(community.id);
    try {
      await this.communityService.leaveCommunity(community.id);
      this.myCommunities.update((list) =>
        list.filter((c) => c.id !== community.id)
      );
      this.messageService.addMessage({
        content: `You have left ${community.name}.`,
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to leave community. Please try again.',
        type: 'error',
      });
    } finally {
      this.leavingId.set(null);
    }
  }

  logout(): void {
    this.authState.logout();
    this.router.navigate(['/']);
  }
}
