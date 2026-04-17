import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import {
  BannerComponent,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { resolveNextSetupRoute } from '../setup-route-policy';
import { TenantContextService } from '../tenant-context.service';

@Component({
  selector: 'fc-settings',
  standalone: true,
  imports: [
    CommonModule,
    ThemeDesignerComponent,
    BannerComponent,
    ProfileEditorComponent,
    ButtonComponent,
  ],
  template: `
    <section class="settings-shell">
      <header class="settings-header">
        <div>
          <p class="eyebrow">Settings</p>
          <h1>Profile and workspace settings</h1>
          <p>
            Manage your Fin Commander profile and visual workspace defaults in
            the app.
          </p>
        </div>
        <otui-button [variant]="'primary'" (action)="openProfileEditor()">
          {{ profile() ? 'Edit profile' : 'Create profile' }}
        </otui-button>
      </header>

      <div class="settings-grid">
        <section class="panel">
          <h2>Profile</h2>
          <lib-banner
            [profileName]="profileName"
            [profileImage]="profileImage"
            [backgroundImage]="backgroundImage"
            (bannerClick)="openProfileEditor()"
          />
        </section>

        <section class="panel">
          <h2>Theme</h2>
          <lib-theme-designer />
        </section>
      </div>

      <lib-profile-editor
        [open]="showProfileEditor"
        [profile]="profile()"
        [defaultName]="profileName"
        (closeEditor)="onProfileEditorClose()"
        (createProfile)="onCreateProfile($event)"
        (updateProfile)="onUpdateProfile($event)"
      />
    </section>
  `,
  styles: [
    `
      .settings-shell {
        width: min(1180px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.5rem 0 4rem;
        display: grid;
        gap: 1rem;
      }
      .settings-header,
      .panel {
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        backdrop-filter: blur(14px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        padding: 1.4rem;
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
      }
      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1rem;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.7rem;
        margin: 0 0 0.4rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.66rem;
        font-weight: 700;
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        width: fit-content;
      }
      h1 {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 700;
        color: var(--foreground);
      }
      h2 {
        margin: 0 0 0.5rem;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
      }
      p {
        margin: 0;
        font-size: 0.88rem;
        color: var(--muted);
        line-height: 1.5;
      }
    `,
  ],
})
export class SettingsComponent {
  private readonly financeService = inject(FinanceService);
  private readonly router = inject(Router);
  private readonly tenantContext = inject(TenantContextService);
  showProfileEditor = false;
  profileName = '';
  profileImage = '';
  backgroundImage = '';
  profile = signal<ProfileDto | null>(null);

  constructor(
    public profileService: ProfileService,
    private readonly auth: AuthStateService
  ) {
    const current = this.profileService.getCurrentUserProfile();
    if (current) {
      this.setProfileFromDto(current);
    } else {
      const user = this.auth.getDecodedTokenValue();
      this.profileName = user?.name ?? '';
    }
  }

  private setProfileFromDto(profile: ProfileDto): void {
    this.profileName = profile.profileName || '';
    this.profileImage = profile.profilePic || '';
    this.backgroundImage = profile.coverPic || '';
    this.profile.set(profile);
  }

  openProfileEditor(): void {
    this.showProfileEditor = true;
  }

  onProfileEditorClose(): void {
    this.showProfileEditor = false;
  }

  async onCreateProfile(dto: any): Promise<void> {
    await this.profileService.createProfile(dto);
    await this.profileService.getAllProfiles();
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.setProfileFromDto(profile);
    }

    await this.tenantContext.loadTenantContext();
    const nextRoute = await resolveNextSetupRoute(
      this.profileService,
      this.tenantContext,
      this.financeService
    );

    if (nextRoute) {
      await this.router.navigate(nextRoute);
    }

    this.showProfileEditor = false;
  }

  async onUpdateProfile(dto: any): Promise<void> {
    await this.profileService.updateProfile(dto.id, dto);
    await this.profileService.getProfileById(dto.id);
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.setProfileFromDto(profile);
    }
    this.showProfileEditor = false;
  }
}
