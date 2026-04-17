import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ProfileContext } from '../profile.context';

@Component({
  selector: 'fc-profile-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-selector" aria-label="Finance profile selector">
      <label class="profile-label" for="fin-profile-selector">Profile</label>
      <select
        id="fin-profile-selector"
        class="profile-select"
        [value]="context.currentProfile()?.id ?? ''"
        (change)="onSelect($event)"
      >
        @for (profile of context.currentProfiles(); track profile.id) {
        <option [value]="profile.id">{{ profile.profileName }}</option>
        }
      </select>
    </div>
  `,
  styles: [
    `
      .profile-selector {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        border: 1px solid var(--border, rgba(148, 163, 184, 0.35));
        border-radius: 999px;
        background: color-mix(in srgb, var(--surface, #fff) 88%, transparent);
        color: var(--foreground, #0f172a);
      }

      .profile-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #64748b);
      }

      .profile-select {
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        min-width: 10rem;
      }
    `,
  ],
})
export class ProfileSelectorComponent {
  readonly context = inject(ProfileContext);

  onSelect(event: Event): void {
    const profileId = (event.target as HTMLSelectElement).value;
    const profile = this.context
      .currentProfiles()
      .find((entry) => entry.id === profileId);

    if (profile) {
      this.context.selectProfile(profile);
    }
  }
}
