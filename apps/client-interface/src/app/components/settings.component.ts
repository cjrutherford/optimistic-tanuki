import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';
import {
  BannerComponent,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import { AuthStateService } from '../state/auth-state.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    ThemeDesignerComponent,
    BannerComponent,
    ProfileEditorComponent,
    ButtonComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  title = 'Settings';

  showThemeDesigner = false;
  showProfileEditor = false;

  // current selected profile values
  profileName = '';
  profileImage = '';
  backgroundImage = '';

  profile = signal<ProfileDto | null>(null);

  constructor(
    public profileService: ProfileService,
    private auth: AuthStateService
  ) {
    try {
      // Load current profile if present
      const p = this.profileService.getCurrentUserProfile();
      if (p) {
        this.setProfileFromDto(p);
      } else {
        // setup empty state defaults from user object
        const user = this.auth.getDecodedTokenValue();
        if (user && user.name) {
          const [first, ...rest] = user.name.split(' ');
          const last = rest.length ? rest.join(' ') : '';
          this.profileName = `${first || ''} ${last || ''}`.trim();
        }
      }
    } catch (e) {
      console.error('Error loading profile in settings:', e);
    }
  }

  setProfileFromDto(p: ProfileDto) {
    this.profileName = p.profileName || '';
    this.profileImage = p.profilePic || '';
    this.backgroundImage = p.coverPic || '';
    this.profile.set(p);
  }

  toggleThemeDesigner() {
    this.showThemeDesigner = !this.showThemeDesigner;
  }

  openProfileEditor() {
    this.showProfileEditor = true;
  }

  onProfileEditorClose() {
    this.showProfileEditor = false;
  }

  async onCreateProfile(dto: any) {
    await this.profileService.createProfile(dto);
    // refresh and set current
    this.profileService.getAllProfiles().then(() => {
      const p = this.profileService.getCurrentUserProfile();
      if (p) this.setProfileFromDto(p as any);
    });
  }

  async onUpdateProfile(dto: any) {
    await this.profileService.updateProfile(dto.id, dto);
    this.profileService.getProfileById(dto.id).then(() => {
      const p = this.profileService.getCurrentUserProfile();
      if (p) this.setProfileFromDto(p as any);
    });
  }
}
