import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ForumAuthoringState = 'loading' | 'denied' | 'empty' | 'ready';

@Component({
  selector: 'ot-forum-authoring-shell',
  standalone: true,
  template: `
    <section class="authoring-shell" aria-labelledby="forum-authoring-title">
      <p class="eyebrow">Workspace authoring</p>
      <h2 id="forum-authoring-title">Forum discussions</h2>
      <p class="context">Workspace: {{ workspaceId }}</p>
      @switch (state) { @case ('loading') {
      <p role="status">Loading discussion authoring…</p>
      } @case ('denied') {
      <p data-authoring-denied role="alert">
        Forum authoring is not available for this workspace.
      </p>
      } @case ('empty') {
      <div data-authoring-empty>
        <p>No discussions yet.</p>
        <button type="button" (click)="createRequested.emit()">
          Create discussion
        </button>
      </div>
      } @case ('ready') {
      <div data-authoring-ready><ng-content /></div>
      } }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .authoring-shell {
        padding: 1.25rem;
        border: 1px solid var(--border);
        border-radius: 1rem;
        background: var(--surface);
      }
      .eyebrow {
        margin: 0;
        color: var(--primary);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .context {
        color: var(--muted);
      }
      button {
        padding: 0.55rem 0.8rem;
        border: 0;
        border-radius: 0.5rem;
        background: var(--primary);
        color: var(--primary-foreground);
        font-weight: 700;
      }
    `,
  ],
})
export class ForumAuthoringShellComponent {
  @Input({ required: true }) workspaceId = '';
  @Input() state: ForumAuthoringState = 'loading';
  @Output() readonly createRequested = new EventEmitter<void>();
}
