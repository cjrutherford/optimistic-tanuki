import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ProjectInvite {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'LEFT';
  createdAt?: string;
  respondedAt?: string;
}

/**
 * Words a status in the way a person reading the list would say it, rather
 * than the constant the server uses. "REVOKED" and "LEFT" both read as
 * finished states to a caller, but they are different decisions made by
 * different people, so they stay distinct here rather than being folded into
 * one "inactive" label.
 */
const STATUS_WORDS: Record<ProjectInvite['status'], string> = {
  PENDING: 'waiting for an answer',
  ACCEPTED: 'on the project',
  DECLINED: 'said no',
  REVOKED: 'withdrawn',
  LEFT: 'left the project',
};

/**
 * The list of who has been invited to a project and where each one stands.
 *
 * Only PENDING and ACCEPTED invites can still be withdrawn; the other
 * statuses are already an ending, so offering a button there would suggest
 * an action that does nothing.
 */
@Component({
  selector: 'lib-project-invite-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invite-list.component.html',
  styleUrl: './invite-list.component.scss',
})
export class ProjectInviteListComponent {
  @Input() invites: ProjectInvite[] = [];
  @Output() revoked = new EventEmitter<string>();

  words(status: ProjectInvite['status']): string {
    return STATUS_WORDS[status];
  }

  canWithdraw(invite: ProjectInvite): boolean {
    return invite.status === 'PENDING' || invite.status === 'ACCEPTED';
  }

  withdraw(invite: ProjectInvite): void {
    this.revoked.emit(invite.id);
  }
}
