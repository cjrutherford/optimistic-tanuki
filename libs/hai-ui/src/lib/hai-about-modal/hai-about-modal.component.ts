import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
} from '@angular/core';
import { ModalComponent, Tab, TabsComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';
import { getRandomHaiExpansion } from '../hai-types/hai-expansions';

@Component({
  selector: 'hai-about-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, TabsComponent],
  templateUrl: './hai-about-modal.component.html',
  styleUrl: './hai-about-modal.component.scss',
})
export class HaiAboutModalComponent implements OnInit {
  @Input({ required: true }) config!: HaiAboutConfig;
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  private readonly appDirectory = inject(HaiAppDirectoryService);

  readonly tabs: Tab[] = [
    { id: 'app', label: 'About This App' },
    { id: 'hai', label: 'About HAI' },
    { id: 'directory', label: 'Other HAI Apps' },
  ];

  activeTab = 'app';
  currentExpansion = '';
  appLinks$ = this.appDirectory.getResolvedApps();

  ngOnInit() {
    this.currentExpansion = getRandomHaiExpansion();
    this.appLinks$ = this.appDirectory.getResolvedApps(this.config?.appId);
  }

  setActiveTab(tabId: string) {
    this.activeTab = tabId;
  }

  handleClose() {
    this.close.emit();
  }
}
