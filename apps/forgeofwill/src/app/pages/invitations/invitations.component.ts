import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProjectInvite, ProjectService } from '../../project/project.service';

/** Plain-words outcome for an invitation that is no longer pending. */
const OUTCOME_WORDS: Record<
  Exclude<ProjectInvite['status'], 'PENDING'>,
  string
> = {
  ACCEPTED: 'you joined',
  DECLINED: 'you said no',
  REVOKED: 'withdrawn',
  LEFT: 'you left',
};

@Component({
  selector: 'app-invitations',
  imports: [CommonModule],
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.scss',
})
export class InvitationsComponent implements OnInit {
  private readonly projectService = inject(ProjectService);

  invitations = signal<ProjectInvite[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * The invitation currently being answered, if any.
   *
   * One at a time is enough: buttons on every other row stay enabled, and
   * this id is what disables the pair on the row in flight so a double click
   * cannot fire two answers for the same invitation.
   */
  respondingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.projectService.getMyInvitations().subscribe({
      next: (invites) => {
        this.invitations.set(invites);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Your invitations could not be loaded. Please try again.'
        );
        this.loading.set(false);
      },
    });
  }

  projectLabel(invite: ProjectInvite): string {
    return invite.projectName || 'a project';
  }

  outcomeWords(invite: ProjectInvite): string | null {
    if (invite.status === 'PENDING') return null;
    return OUTCOME_WORDS[invite.status];
  }

  respond(invite: ProjectInvite, accept: boolean): void {
    if (this.respondingId()) return;
    this.respondingId.set(invite.id);
    this.error.set(null);
    this.projectService.respondToInvitation(invite.id, accept).subscribe({
      next: () => {
        this.respondingId.set(null);
        this.load();
      },
      error: () => {
        this.respondingId.set(null);
        this.error.set('That answer could not be sent. Please try again.');
      },
    });
  }
}
