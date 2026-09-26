import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private profiles = inject(ProfileAPIService);
  private authState = inject(AuthStateService);
  private destroy$ = new Subject<void>();

  profile = signal<ProfileDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isOwnProfile = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      this.profile.set(null);
      this.error.set(null);
      this.loading.set(true);
      this.isOwnProfile.set(false);
      this.loadProfile(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProfile(id: string): Promise<void> {
    try {
      const profile = id
        ? await firstValueFrom(
            this.profiles.profileControllerGetProfileById<ProfileDto>(id)
          )
        : await firstValueFrom(
            this.profiles.profileControllerGetCurrentProfile<ProfileDto>()
          );
      this.profile.set(profile);
      const actingId = this.authState.getActingProfileId();
      this.isOwnProfile.set(!!actingId && profile?.id === actingId);
    } catch {
      this.error.set('Could not load this profile. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  contactSeller(): void {
    const profile = this.profile();
    if (profile) {
      this.router.navigate(['/messages/new'], {
        queryParams: { to: profile.id },
      });
    }
  }
}
