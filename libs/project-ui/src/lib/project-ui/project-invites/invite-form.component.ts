import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Inviting somebody to a project, as a single email field.
 *
 * The form does not know how invitations are sent or what happens if the
 * address is already a member; it only refuses to emit a blank or
 * whitespace-only address, since that would be a wasted round trip to the
 * server for an error the field can catch itself.
 */
@Component({
  selector: 'lib-project-invite-form',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invite-form.component.html',
  styleUrl: './invite-form.component.scss',
})
export class ProjectInviteFormComponent {
  @Input() busy = false;
  @Input() error: string | null = null;
  @Output() invited = new EventEmitter<string>();

  email = '';

  emailChanged(event: Event): void {
    this.email = (event.target as HTMLInputElement).value;
  }

  submit(): void {
    const trimmed = this.email.trim();
    if (!trimmed || this.busy) return;
    this.invited.emit(trimmed);
    this.email = '';
  }
}
