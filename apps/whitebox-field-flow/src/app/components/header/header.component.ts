import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChipComponent } from '@optimistic-tanuki/common-ui';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'flow-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ChipComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly brandConfig = inject(BrandConfigService);
  readonly auth = inject(CustomerAuthService);

  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  signOut(): void {
    this.auth.logout().subscribe({ error: () => undefined });
    this.closeMenu();
  }
}
