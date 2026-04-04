import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  BannerComponent,
  ProfileEditorComponent,
  ProfileSelectorComponent,
} from '@optimistic-tanuki/profile-ui';
import type { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-profile-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    BannerComponent,
    ProfileEditorComponent,
    ProfileSelectorComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/profile-ui"
      title="Profile UI"
      description="Profile selection, identity presentation, and editing flows for multi-profile experiences."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('banner') {
        <div class="preview-padded">
          <lib-banner
            [profileName]="selectedProfile.profileName"
            [profileImage]="selectedProfile.profilePic"
            [backgroundImage]="selectedProfile.coverPic"
          />
        </div>
        } @case ('profile-selector') {
        <div class="preview-padded">
          <lib-profile-selector
            [profiles]="profiles"
            [currentSelectedProfile]="selectedProfile"
          />
        </div>
        } @case ('profile-editor') {
        <div class="preview-padded">
          <lib-profile-editor
            [open]="true"
            [profile]="selectedProfile"
            [defaultName]="selectedProfile.profileName"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileUiPageComponent {
  readonly importSnippet = `import { BannerComponent, ProfileSelectorComponent, ProfileEditorComponent } from '@optimistic-tanuki/profile-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly profiles: ProfileDto[] = [
    {
      id: 'profile-1',
      profileName: 'Ari Stone',
      profilePic: 'https://placehold.co/120x120/0f172a/e2e8f0?text=AS',
      coverPic:
        'https://placehold.co/1200x320/1e293b/e2e8f0?text=Profile+Banner',
      userId: 'user-1',
      bio: 'Developer experience lead with a bias toward polished internal tools.',
      location: 'Savannah, GA',
      occupation: 'Engineer',
      interests: 'Design systems, docs, platform UX',
      skills: 'Angular, UI systems',
      created_at: new Date('2026-01-10T10:00:00Z'),
    },
  ];
  readonly selectedProfile = this.profiles[0];
  readonly elements: PlaygroundElement[] = [
    {
      id: 'banner',
      title: 'Banner',
      headline: 'Profile hero strip',
      importName: 'BannerComponent',
      selector: 'lib-banner',
      summary: 'Visual identity strip for a selected profile.',
      props: [],
    },
    {
      id: 'profile-selector',
      title: 'Profile Selector',
      headline: 'Multi-profile picker',
      importName: 'ProfileSelectorComponent',
      selector: 'lib-profile-selector',
      summary: 'Chooser for switching between available user profiles.',
      props: [],
    },
    {
      id: 'profile-editor',
      title: 'Profile Editor',
      headline: 'Inline profile editing workflow',
      importName: 'ProfileEditorComponent',
      selector: 'lib-profile-editor',
      summary: 'Modal editing surface for profile identity, media, and bio fields.',
      props: [],
    },
  ];

  constructor() {
    for (const element of this.elements) {
      this.configs[element.id] = {};
    }
  }
}
