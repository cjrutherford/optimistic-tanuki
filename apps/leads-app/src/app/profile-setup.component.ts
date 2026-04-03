import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreateProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-profile-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="setup-shell">
      <div class="setup-card">
        <p class="eyebrow">Profile Setup</p>
        <h1>Configure your Leads profile.</h1>
        <p class="intro">
          This creates your app-scoped profile for Lead Command before
          onboarding and workspace access.
        </p>

        <form (ngSubmit)="saveProfile()" #form="ngForm">
          <label>
            Name
            <input
              [(ngModel)]="profile.name"
              name="name"
              required
              placeholder="Your name or operator name"
            />
          </label>

          <label>
            Description
            <textarea
              [(ngModel)]="profile.description"
              name="description"
              rows="3"
              placeholder="What kind of leads are you pursuing?"
            ></textarea>
          </label>

          <label>
            Bio
            <textarea
              [(ngModel)]="profile.bio"
              name="bio"
              rows="4"
              placeholder="Short background and focus"
            ></textarea>
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

          <p *ngIf="error" class="error">{{ error }}</p>

          <button type="submit" [disabled]="saving || !form.form.valid">
            {{ saving ? 'Saving…' : 'Create Leads Profile' }}
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .setup-shell {
        min-height: calc(100vh - 56px);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem 1rem;
      }
      .setup-card {
        width: min(760px, 100%);
        padding: 2rem;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-xl);
        background: var(--app-surface);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
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
        margin: 0 0 0.75rem;
      }
      .intro {
        margin: 0 0 1.5rem;
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
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .error {
        margin: 0;
        color: #b91c1c;
      }
      @media (max-width: 720px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .setup-card {
          padding: 1.25rem;
        }
      }
    `,
  ],
})
export class ProfileSetupComponent {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  saving = false;
  error = '';
  profile: CreateProfileDto = {
    name: '',
    description: '',
    userId: '' as string,
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
  };

  async saveProfile() {
    this.saving = true;
    this.error = '';

    try {
      await this.profileService.createProfile(this.profile);
      await this.profileService.getAllProfiles();
      await this.router.navigate(['/onboarding']);
    } catch (error) {
      this.error = 'Unable to create your Leads profile right now.';
    } finally {
      this.saving = false;
    }
  }
}
