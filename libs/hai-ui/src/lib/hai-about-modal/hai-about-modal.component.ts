import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalComponent, Tab, TabsComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { getHaiAppLinks } from '../hai-types/hai-app.directory';

@Component({
  selector: 'hai-about-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, TabsComponent],
  templateUrl: './hai-about-modal.component.html',
  styleUrl: './hai-about-modal.component.scss',
})
export class HaiAboutModalComponent {
  @Input({ required: true }) config!: HaiAboutConfig;
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  readonly tabs: Tab[] = [
    { id: 'app', label: 'About This App' },
    { id: 'hai', label: 'About HAI' },
    { id: 'directory', label: 'Other HAI Apps' },
  ];

  activeTab = 'app';

  get appLinks() {
    return getHaiAppLinks(this.config?.appId);
  }

  setActiveTab(tabId: string) {
    this.activeTab = tabId;
  }

  handleClose() {
    this.close.emit();
  }
}
