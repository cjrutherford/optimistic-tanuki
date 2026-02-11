import { Component, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements AfterViewInit {
  private router = inject(Router);
  private themeService = inject(ThemeService);

  heroGradient = '';
  buttonGradient = '';

  features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description:
        'Get things done quickly with our optimized workflow tools that respond instantly to your will.',
    },
    {
      icon: '🎯',
      title: 'Goal Focused',
      description:
        'Set objectives and track progress with precision. Every milestone is a forge triumph.',
    },
    {
      icon: '🤖',
      title: 'AI Powered',
      description:
        'Intelligent assistance that adapts to your needs, like having a master smith at your side.',
    },
    {
      icon: '📊',
      title: 'Data Driven',
      description:
        'Make informed decisions with powerful analytics that reveal the patterns in your work.',
    },
    {
      icon: '👥',
      title: 'Team Ready',
      description:
        'Collaborate seamlessly with your entire team. Many hands make light work.',
    },
    {
      icon: '🔒',
      title: 'Secure & Reliable',
      description:
        'Your data is protected with enterprise-grade security. Guarded like treasure.',
    },
  ];

  stats = [
    { value: '10K+', label: 'Active Smiths' },
    { value: '50M+', label: 'Tasks Forged' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9★', label: 'Rating' },
  ];

  ngAfterViewInit() {
    this.updateGradients();
    this.initParticleField();
  }

  private updateGradients(): void {
    this.heroGradient = this.themeService.getHeaderGradient();
    this.buttonGradient = this.themeService.getButtonGradient('primary');
  }

  private initParticleField(): void {
    const particleContainer = document.getElementById('particles');
    if (!particleContainer) return;

    const particleCount = 25;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'ember-particle';

      const size = Math.random() * 3 + 1;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = Math.random() * 10 + 10;

      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, var(--accent), transparent);
        border-radius: 50%;
        left: ${x}%;
        top: ${y}%;
        opacity: ${Math.random() * 0.5 + 0.2};
        animation: ember-float ${duration}s ease-in-out ${delay}s infinite;
        pointer-events: none;
      `;

      particleContainer.appendChild(particle);
    }

    if (!document.getElementById('ember-styles')) {
      const style = document.createElement('style');
      style.id = 'ember-styles';
      style.textContent = `
        @keyframes ember-float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          25% {
            transform: translate(30px, -30px) scale(1.2);
            opacity: 0.6;
          }
          50% {
            transform: translate(-20px, -50px) scale(0.8);
            opacity: 0.2;
          }
          75% {
            transform: translate(20px, -30px) scale(1);
            opacity: 0.4;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}
