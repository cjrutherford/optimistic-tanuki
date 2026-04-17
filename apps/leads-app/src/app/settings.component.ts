import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';

type LeadsProfileFormState = {
  profileName: string;
  bio: string;
  location: string;
  occupation: string;
  interests: string;
  skills: string;
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="settings-shell">
      <div class="settings-card">
        <div class="header">
          <div>
            <p class="eyebrow">Settings</p>
            <h1>Leads profile</h1>
          </div>
          <p class="hint">Updates apply to your leads-app profile only.</p>
        </div>

        <form *ngIf="profileId" (ngSubmit)="saveProfile()">
          <label>
            Name
            <input [(ngModel)]="profile.profileName" name="profileName" required />
          </label>

          <label>
            Bio
            <textarea [(ngModel)]="profile.bio" name="bio" rows="4"></textarea>
          </label>

          <div class="grid">
            <label>
              Location
              <input [(ngModel)]="profile.location" name="location" />
            </label>
            <label>
              Occupation
              <input [(ngModel)]="profile.occupation" name="occupation" />
            </label>
          </div>

          <div class="grid">
            <label>
              Interests
              <input [(ngModel)]="profile.interests" name="interests" />
            </label>
            <label>
              Skills
              <input [(ngModel)]="profile.skills" name="skills" />
            </label>
          </div>

          <p *ngIf="saved" class="saved">Profile updated.</p>

          <button type="submit">Save Changes</button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .settings-shell {
        padding: 2rem 1rem 3rem;
        display: flex;
        justify-content: center;
      }
      .settings-card {
        width: min(760px, 100%);
        padding: 2rem;
        border-radius: var(--radius-xl);
        border: 1px solid var(--app-border);
        background: var(--app-surface);
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--app-primary);
      }
      h1 {
        margin: 0;
      }
      .hint {
        margin: 0;
        color: var(--app-foreground-muted);
      }
      form {
        display: grid;
        gap: 1rem;
      }
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      label {
        display: grid;
        gap: 0.4rem;
        font-size: 0.9rem;
        font-weight: 600;
      }
      input,
      textarea {
        width: 100%;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-md);
        background: var(--app-background);
        color: var(--app-foreground);
        padding: 0.8rem 0.9rem;
        font: inherit;
      }
      button {
        justify-self: start;
        border: 0;
        border-radius: 999px;
        padding: 0.85rem 1.35rem;
        background: var(--app-primary);
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .saved {
        margin: 0;
        color: #166534;
      }
      @media (max-width: 720px) {
        .header,
        .grid {
          grid-template-columns: 1fr;
          display: grid;
        }
        .settings-card {
          padding: 1.25rem;
        }
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly profileService = inject(ProfileService);

  profileId = '';
  saved = false;
  profile: LeadsProfileFormState = {
    profileName: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
  };

  ngOnInit() {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      return;
    }

    this.profileId = currentProfile.id;
    this.profile = {
      profileName: currentProfile.profileName ?? '',
      bio: currentProfile.bio ?? '',
      location: currentProfile.location ?? '',
      occupation: currentProfile.occupation ?? '',
      interests: currentProfile.interests ?? '',
      skills: currentProfile.skills ?? '',
    };
  }

  async saveProfile() {
    if (!this.profileId) {
      return;
    }

    this.saved = false;
    const update: UpdateProfileDto = {
      id: this.profileId,
      name: this.profile.profileName,
      bio: this.profile.bio,
      location: this.profile.location,
      occupation: this.profile.occupation,
      interests: this.profile.interests,
      skills: this.profile.skills,
    };

    await this.profileService.updateProfile(this.profileId, update);
    this.saved = true;
  }
}
