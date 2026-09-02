import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

/**
 * Who is on a project, as a thing a person can actually look at.
 *
 * A project cannot be left without an owner, so the owner is never offered a
 * remove button, and removing someone else is only offered to the owner.
 * Everyone else gets a read-only list, because a control nobody can use is
 * worse than no control at all.
 */
export interface ProjectPerson {
  profileId: string;
  name?: string;
  isOwner: boolean;
}

@Component({
  selector: 'lib-project-members',
  standalone: true,
  imports: [CommonModule, ProfilePhotoComponent],
  templateUrl: './project-members.component.html',
  styleUrl: './project-members.component.scss',
})
export class ProjectMembersComponent {
  @Input() people: ProjectPerson[] = [];
  /** Who is looking, so the viewer can be told apart from everyone else. */
  @Input() viewerProfileId = '';
  @Input() viewerIsOwner = false;
  @Output() removed = new EventEmitter<string>();
  @Output() left = new EventEmitter<void>();

  /** The name to show, falling back to the id rather than an empty row. */
  displayName(person: ProjectPerson): string {
    return person.name || person.profileId;
  }

  /**
   * People with nothing to show for them are left out entirely.
   *
   * A person with no name and no id would otherwise render as a blank row,
   * which is worse than not showing it.
   */
  get visiblePeople(): ProjectPerson[] {
    return this.people.filter((person) => this.displayName(person));
  }

  /**
   * Whether the viewer, who is a member but not the owner, can leave.
   *
   * A non-member has nothing to leave, and the owner cannot leave without
   * first handing the project to somebody else, which this component does
   * not offer.
   */
  get canLeave(): boolean {
    return this.people.some(
      (person) => person.profileId === this.viewerProfileId && !person.isOwner
    );
  }
}
