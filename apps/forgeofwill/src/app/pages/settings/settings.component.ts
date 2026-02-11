import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeDesignerComponent,
  PersonalitySelectorComponent,
} from '@optimistic-tanuki/theme-ui';
import {
  BannerComponent,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../../profile/profile.service';
import { AuthStateService } from '../../auth-state.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  CreateProfileDto,
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

  profileName = '';
  profileImage = '';
  backgroundImage = '';
  profile = signal<ProfileDto | null>(null);

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

  ngOnInit() {
    const p = this.profileService.getCurrentUserProfile();
    if (p) {
      this.setProfileFromDto(p);
    } else {
      const user = this.auth.getDecodedTokenValue();
      if (user && user.name) {
        const [first, ...rest] = user.name.split(' ');
        const last = rest.length ? rest.join(' ') : '';
        this.profileName = `${first || ''} ${last || ''}`.trim();
      }
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
      if (p) this.setProfileFromDto(p);
    });
  }

  async onUpdateProfile(dto: UpdateProfileDto) {
    await this.profileService.updateProfile(dto.id, dto);
    this.profileService.getProfileById(dto.id).then(() => {
      const p = this.profileService.getCurrentUserProfile();
      if (p) this.setProfileFromDto(p);
    });
  }
}
