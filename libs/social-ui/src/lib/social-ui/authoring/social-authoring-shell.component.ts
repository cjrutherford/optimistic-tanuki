import { Component, EventEmitter, Input, Output } from '@angular/core';

export type SocialAuthoringState = 'loading' | 'denied' | 'empty' | 'ready';

@Component({
  selector: 'ot-social-authoring-shell',
  standalone: true,
  template: `
    <section class="authoring-shell" aria-labelledby="social-authoring-title">
      <p class="eyebrow">Workspace authoring</p>
      <h2 id="social-authoring-title">Community activity</h2>
      <p class="context">Workspace: {{ workspaceId }}</p>
      @switch (state) { @case ('loading') {
      <p role="status">Loading community authoring…</p>
      } @case ('denied') {
      <p data-authoring-denied role="alert">
        Social authoring is not available for this workspace.
      </p>
      } @case ('empty') {
      <div data-authoring-empty>
        <p>No activity yet.</p>
        <button type="button" (click)="createRequested.emit()">
          Create update
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
        border: 1px solid var(--border, #d7dce5);
        border-radius: 1rem;
        background: var(--surface, #fff);
      }
      .eyebrow {
        margin: 0;
        color: var(--primary, #315fdd);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .context {
        color: var(--muted, #64748b);
      }
      button {
        padding: 0.55rem 0.8rem;
        border: 0;
        border-radius: 0.5rem;
        background: var(--primary, #315fdd);
        color: #fff;
        font-weight: 700;
      }
    `,
  ],
})
export class SocialAuthoringShellComponent {
  @Input({ required: true }) workspaceId = '';
  @Input() state: SocialAuthoringState = 'loading';
  @Output() readonly createRequested = new EventEmitter<void>();
}
