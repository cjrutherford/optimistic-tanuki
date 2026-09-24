import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';

@Component({
  selector: 'flow-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly brandConfig = inject(BrandConfigService);
  readonly syncService = inject(FieldFlowSyncService);

  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  triggerSync(): void {
    void this.syncService.syncPendingData();
  }
}
