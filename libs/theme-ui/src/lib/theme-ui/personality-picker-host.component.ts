import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Personality } from '@optimistic-tanuki/theme-lib';
import { PersonalitySelectorComponent } from './personality-selector.component';

@Component({
  selector: 'lib-personality-picker-host',
  standalone: true,
  imports: [PersonalitySelectorComponent],
  template: `
    <lib-personality-selector
      [personalities]="personalities"
      [currentPersonality]="currentPersonality"
      [titleId]="titleId"
      [applyOnSelect]="false"
      (personalitySelected)="personalitySelected.emit($event)"
      (onClose)="closed.emit()"
    ></lib-personality-selector>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        max-width: 100%;
        max-height: 100%;
      }
    `,
  ],
})
export class PersonalityPickerHostComponent {
  @Input() personalities: Personality[] = [];
  @Input() currentPersonality: Personality | null = null;
  @Input() titleId = '';
  @Output() personalitySelected = new EventEmitter<Personality>();
  @Output() closed = new EventEmitter<void>();
}
