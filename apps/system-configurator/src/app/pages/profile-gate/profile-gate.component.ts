import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent, TextAreaComponent } from '@optimistic-tanuki/form-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../../state/profile.service';
import { ReturnIntentService } from '../../state/return-intent.service';

@Component({
  selector: 'app-profile-gate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  template: `
    <section class="gate-shell">
      <otui-card class="gate-card">
        <div class="gate-header">
          <p class="eyebrow">HAI Identity Link</p>
          <h1>Finish your integrator profile</h1>
          <p>
            Orders and post-purchase support are attached to a HAI profile.
            Choose an existing profile or create a dedicated system profile.
          </p>
        </div>

        <div class="gate-layout">
          <div class="panel">
            <h2>Available profiles</h2>
            <button
              *ngFor="let profile of profiles()"
              type="button"
              class="profile-option"
              [class.active]="selectedProfile()?.id === profile.id"
              (click)="selectProfile(profile)"
            >
              <span>{{ profile.profileName }}</span>
              <small>{{ profile.appScope || 'global' }}</small>
            </button>

            <button
              *ngIf="selectedProfile()"
              type="button"
              class="continue-button"
              (click)="continueWithSelectedProfile()"
            >
              Continue with selected profile
            </button>
          </div>

          <div class="panel">
            <h2>Create a HAI profile</h2>
            <label>Profile name</label>
            <lib-text-input
              [(ngModel)]="profileName"
              name="profileName"
              label=""
              placeholder="HAI Build Lead"
            ></lib-text-input>

            <label>Role or purpose</label>
            <lib-text-input
              [(ngModel)]="occupation"
              name="occupation"
              label=""
              placeholder="Systems integrator"
            ></lib-text-input>

            <label>Short bio</label>
            <lib-text-area
              [(ngModel)]="bio"
              name="bio"
            ></lib-text-area>

            <button
              type="button"
              class="create-button"
              [disabled]="!profileName.trim()"
              (click)="createProfile()"
            >
              Create profile and continue
            </button>
          </div>
        </div>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .gate-shell {
        padding: 2rem;
        min-height: calc(100vh - 9rem);
        display: grid;
        place-items: center;
      }

      .gate-card {
        width: min(1100px, 100%);
      }

      .gate-header {
        margin-bottom: 2rem;
      }

      .eyebrow {
        margin: 0 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.75rem;
        opacity: 0.72;
      }

      .gate-layout {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.5rem;
      }

      .panel {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.5rem;
        padding: 1.25rem;
        background: rgba(255, 255, 255, 0.03);
      }

      .panel h2 {
        margin-top: 0;
      }

      .profile-option,
      .continue-button,
      .create-button {
        width: 100%;
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
        padding: 0.9rem 1rem;
        text-align: left;
        cursor: pointer;
        margin-bottom: 0.75rem;
      }

      .profile-option.active {
        border-color: var(--hai-accent);
        box-shadow: 0 0 0 1px var(--hai-accent);
      }

      label {
        display: block;
        margin: 0.75rem 0 0.4rem;
      }

      @media (max-width: 860px) {
        .gate-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProfileGateComponent {
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly returnIntent = inject(ReturnIntentService);

  profiles = signal<ProfileDto[]>(this.profileService.getCurrentUserProfiles());
  selectedProfile = signal<ProfileDto | null>(
    this.profileService.getEffectiveProfile()
  );

  profileName = '';
  occupation = '';
  bio = '';

  constructor() {
    this.profileService.getAllProfiles().then(() => {
      this.profiles.set(this.profileService.getCurrentUserProfiles());
      this.selectedProfile.set(this.profileService.getEffectiveProfile());
    });
  }

  selectProfile(profile: ProfileDto): void {
    this.selectedProfile.set(profile);
  }

  continueWithSelectedProfile(): void {
    const profile = this.selectedProfile();
    if (!profile) {
      return;
    }

    this.profileService.selectProfile(profile);
    this.goToReturnIntent();
  }

  async createProfile(): Promise<void> {
    const profile = await this.profileService.createProfile({
      name: this.profileName,
      description: this.bio,
      userId: '',
      profilePic: '',
      coverPic: '',
      bio: this.bio,
      location: '',
      occupation: this.occupation,
      interests: 'systems integration',
      skills: 'hardware configuration',
      appScope: 'system-configurator',
    });

    this.messageService.addMessage({
      content: `Profile ${profile.profileName} is ready for checkout.`,
      type: 'success',
    });

    this.goToReturnIntent();
  }

  private goToReturnIntent(): void {
    const destination = this.returnIntent.consume() || '/checkout';
    this.router.navigate([destination]);
  }
}
