import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { MurmurationSceneComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent, MurmurationSceneComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private router = inject(Router);

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
