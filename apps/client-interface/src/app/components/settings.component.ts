import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';
import {
  CharacterSheetComponent,
  type CharacterSheetSkin,
  SettingsShellComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import { AuthStateService } from '../state/auth-state.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  CreateProfileDto,
  ProfileDto,
  ProfileTelosDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    ThemeDesignerComponent,
    SettingsShellComponent,
    CharacterSheetComponent,
    ButtonComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  title = 'Settings';
  description =
    'Keep your profile current, shape the visual identity of your space, and make the next step obvious for people who visit it.';

  showThemeDesigner = false;

  // current selected profile values
  profileName = '';
  profileImage = '';
  backgroundImage = '';

  profile = signal<ProfileDto | null>(null);
  profileTelos = signal<ProfileTelosDto | null>(null);
  characterSheetEnabled = signal(false);
  characterSheetSkin = signal<CharacterSheetSkin>('fantasy');

  constructor(
    public profileService: ProfileService,
    private auth: AuthStateService
  ) {
    try {
      // Load current profile if present
      const p = this.profileService.getCurrentUserProfile();
      if (p) {
        this.setProfileFromDto(p);
        void this.loadProfileTelos(p.id);
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

    void this.loadCharacterSheetConfig();
  }

  setProfileFromDto(p: ProfileDto) {
    this.profileName = p.profileName || '';
    this.profileImage = p.profilePic || '';
    this.backgroundImage = p.coverPic || '';
    this.profile.set(p);
  }

  private syncProfileFromService() {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (currentProfile) {
      this.setProfileFromDto(currentProfile);
    }
  }

  toggleThemeDesigner() {
    this.showThemeDesigner = !this.showThemeDesigner;
  }

  async onCreateProfile(dto: CreateProfileDto) {
    await this.profileService.createProfile(dto);
    this.syncProfileFromService();
    const currentProfile = this.profile();
    if (currentProfile?.id) {
      await this.loadProfileTelos(currentProfile.id);
    }
  }

  private async loadCharacterSheetConfig() {
    const { enabled, skin } =
      await this.profileService.loadCharacterSheetConfig();
    this.characterSheetEnabled.set(enabled);
    this.characterSheetSkin.set(skin);

    if (!enabled) {
      this.profileTelos.set(null);
      return;
    }

    const profile = this.profile();
    if (profile?.id) {
      void this.loadProfileTelos(profile.id);
    }
  }

  private async loadProfileTelos(profileId: string) {
    if (!this.characterSheetEnabled()) {
      this.profileTelos.set(null);
      return;
    }

    const telos = await this.profileService.getProfileTelos(profileId);
    this.profileTelos.set(telos);
  }

  async onUpdateProfile(dto: UpdateProfileDto) {
    await this.profileService.updateProfile(dto.id, dto);
    this.syncProfileFromService();
    const currentProfile = this.profile();
    if (currentProfile?.id) {
      await this.loadProfileTelos(currentProfile.id);
    }
  }
}
