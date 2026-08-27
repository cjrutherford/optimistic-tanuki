import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import {
  CardComponent,
  ButtonComponent,
  IconComponent,
} from '@optimistic-tanuki/common-ui';
import { AuthStateService } from '../state/auth-state.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent, IconComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private readonly authStateService = inject(AuthStateService);

  ngOnInit(): void {
    void this.restoreExistingSession();
  }

  private async restoreExistingSession(): Promise<void> {
    try {
      if (await this.authStateService.restoreSession()) {
        await this.router.navigate(['/feed']);
      }
    } catch {
      // The public landing page remains available when no browser session exists.
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }

  scrollToHowItWorks(): void {
    const featuresSection = document.getElementById('how-it-works');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
