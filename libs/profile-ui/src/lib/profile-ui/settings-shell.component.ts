import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import {
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';

import { BannerComponent } from './banner/banner.component';
import { ProfileEditorComponent } from './profile-editor.component';

@Component({
  selector: 'lib-settings-shell',
  standalone: true,
  imports: [CommonModule, BannerComponent, ProfileEditorComponent],
  template: `
    <div class="settings-shell">
      <header class="settings-header">
        <p class="settings-kicker">Workspace settings</p>
        <h1>{{ title }}</h1>
        <p class="settings-description">{{ description }}</p>
      </header>

      <ng-content select="[settings-prelude]"></ng-content>

      <section class="settings-section">
        <div class="section-heading">
          <h2>Profile</h2>
          <p>Keep your identity, cover media, and profile copy current.</p>
        </div>

        <div
          class="profile-card"
          data-profile-editor-trigger
          (click)="openProfileEditor()"
          (keydown.enter)="openProfileEditor()"
          (keydown.space)="openProfileEditor(); $event.preventDefault()"
          tabindex="0"
          role="button"
          [attr.aria-label]="profileHint"
        >
          <lib-banner
            [profileName]="profileName"
            [profileImage]="profileImage"
            [backgroundImage]="backgroundImage"
            (bannerClick)="openProfileEditor()"
          ></lib-banner>
          <div class="profile-overlay">
            <span class="profile-hint">{{ profileHint }}</span>
          </div>
        </div>
      </section>

      @if (hasThemeSection) {
      <section class="settings-section settings-section-theme">
        <ng-content select="[settings-theme]"></ng-content>
      </section>
      }

      <ng-content select="[settings-postlude]"></ng-content>

      <lib-profile-editor
        [open]="showProfileEditor()"
        [profile]="profile"
        [defaultName]="defaultName"
        (createProfile)="createProfile.emit($event)"
        (updateProfile)="updateProfile.emit($event)"
        (closeEditor)="onProfileEditorClose()"
      ></lib-profile-editor>
    </div>
  `,
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {
  @Input() title = 'Settings';
  @Input() description =
    'Adjust your profile and workspace preferences in one place.';
  @Input() profileName = '';
  @Input() profileImage = '';
  @Input() backgroundImage = '';
  @Input() profile: ProfileDto | null = null;
  @Input() defaultName = '';
  @Input() profileHint = 'Open profile editor';
  @Input() hasThemeSection = false;

  @Output() createProfile = new EventEmitter<CreateProfileDto>();
  @Output() updateProfile = new EventEmitter<UpdateProfileDto>();

  readonly showProfileEditor = signal(false);

  openProfileEditor() {
    this.showProfileEditor.set(true);
  }

  onProfileEditorClose() {
    this.showProfileEditor.set(false);
  }
}
