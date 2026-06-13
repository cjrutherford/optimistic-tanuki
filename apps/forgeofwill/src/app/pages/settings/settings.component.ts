import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeDesignerComponent,
  PersonalitySelectorComponent,
} from '@optimistic-tanuki/theme-ui';
import {
  BannerComponent,
  CharacterSheetComponent,
  type CharacterSheetSkin,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../../profile/profile.service';
import { AuthStateService } from '../../auth-state.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  CreateProfileDto,
  ProfileTelosDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { ThemeService, Personality } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    ThemeDesignerComponent,
    PersonalitySelectorComponent,
    BannerComponent,
    CharacterSheetComponent,
    ProfileEditorComponent,
    ButtonComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  title = 'Settings';

  showThemeDesigner = false;
  showProfileEditor = false;

  profileName = '';
  profileImage = '';
  backgroundImage = '';
  profile = signal<ProfileDto | null>(null);
  profileTelos = signal<ProfileTelosDto | null>(null);
  characterSheetEnabled = signal(false);
  characterSheetSkin = signal<CharacterSheetSkin>('fantasy');

  currentPersonalityId = signal<string>('bold');

  private themeService = inject(ThemeService);
  private profileService = inject(ProfileService);
  private auth = inject(AuthStateService);

  constructor() {
    this.loadCurrentPersonality();
  }

  private loadCurrentPersonality(): void {
    const config = this.themeService.getPersonalityConfig();
    this.currentPersonalityId.set(config.personalityId);
  }

  async ngOnInit() {
    const p = this.profileService.getCurrentUserProfile();
    if (p) {
      this.setProfileFromDto(p);
      this.profileTelos.set(await this.profileService.getProfileTelos(p.id));
    } else {
      const user = this.auth.getDecodedTokenValue();
      if (user && user.name) {
        const [first, ...rest] = user.name.split(' ');
        const last = rest.length ? rest.join(' ') : '';
        this.profileName = `${first || ''} ${last || ''}`.trim();
      }
    }
    const { enabled, skin } =
      await this.profileService.loadCharacterSheetConfig();
    this.characterSheetEnabled.set(enabled);
    this.characterSheetSkin.set(skin);
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

  onPersonalitySelected(personality: Personality): void {
    this.currentPersonalityId.set(personality.id);
  }

  openProfileEditor() {
    this.showProfileEditor = true;
  }

  onProfileEditorClose() {
    this.showProfileEditor = false;
  }

  async onCreateProfile(dto: CreateProfileDto) {
    await this.profileService.createProfile(dto);
    this.profileService.getAllProfiles().then(() => {
      const p = this.profileService.getCurrentUserProfile();
      if (p) {
        this.setProfileFromDto(p);
        void this.profileService.getProfileTelos(p.id).then((telos) => {
          this.profileTelos.set(telos);
        });
      }
    });
  }

  async onUpdateProfile(dto: UpdateProfileDto) {
    await this.profileService.updateProfile(dto.id, dto);
    this.profileService.getProfileById(dto.id).then(() => {
      const p = this.profileService.getCurrentUserProfile();
      if (p) {
        this.setProfileFromDto(p);
        void this.profileService.getProfileTelos(p.id).then((telos) => {
          this.profileTelos.set(telos);
        });
      }
    });
  }
}
