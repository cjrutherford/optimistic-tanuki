import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StateMessageComponent,
  StateMessageTone,
} from './state-message.component';

@Component({
  selector: 'otui-empty-state',
  standalone: true,
  imports: [CommonModule, StateMessageComponent],
  template: `
    <otui-state-message
      kind="empty"
      [tone]="tone"
      [headline]="headline"
      [body]="body"
      [iconGlyph]="iconGlyph"
    >
      <ng-content select="[slot=icon]"></ng-content>
      <ng-content select="[slot=actions]"></ng-content>
      <ng-content></ng-content>
    </otui-state-message>
  `,
})
export class EmptyStateComponent {
  @Input() headline = 'Nothing here yet';
  @Input() body?: string;
  @Input() iconGlyph?: string = '\u2728';
  @Input() tone: StateMessageTone = 'neutral';
}

@Component({
  selector: 'otui-loading-state',
  standalone: true,
  imports: [CommonModule, StateMessageComponent],
  template: `
    <otui-state-message
      kind="loading"
      [tone]="tone"
      [headline]="headline"
      [body]="body"
      [iconGlyph]="iconGlyph"
    >
      <ng-content select="[slot=icon]"></ng-content>
      <ng-content select="[slot=actions]"></ng-content>
      <ng-content></ng-content>
    </otui-state-message>
  `,
})
export class LoadingStateComponent {
  @Input() headline = 'Loading\u2026';
  @Input() body?: string;
  @Input() iconGlyph?: string = '\u25CF';
  @Input() tone: StateMessageTone = 'info';
}

@Component({
  selector: 'otui-error-state',
  standalone: true,
  imports: [CommonModule, StateMessageComponent],
  template: `
    <otui-state-message
      kind="error"
      [tone]="tone"
      [headline]="headline"
      [body]="body"
      [iconGlyph]="iconGlyph"
    >
      <ng-content select="[slot=icon]"></ng-content>
      <ng-content select="[slot=actions]"></ng-content>
      <ng-content></ng-content>
    </otui-state-message>
  `,
})
export class ErrorStateComponent {
  @Input() headline = 'Something went wrong';
  @Input() body?: string;
  @Input() iconGlyph?: string = '\u26A0';
  @Input() tone: StateMessageTone = 'danger';
}
