import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HardwareService, Chassis } from '../../services/hardware.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-container">
      <header class="landing-header">
        <h1>Build Your Custom Server</h1>
        <p>Select a chassis to get started</p>
      </header>

      <div class="chassis-grid">
        <div
          *ngFor="let chassis of chassisList"
          class="chassis-card"
          (click)="selectChassis(chassis)"
        >
          <div
            class="chassis-icon"
            [class]="'type-' + chassis.type.toLowerCase()"
          >
            {{ chassis.type }}
          </div>
          <h3>{{ chassis.name }}</h3>
          <p class="use-case">{{ chassis.useCase | uppercase }}</p>
          <p class="description">{{ chassis.description }}</p>
          <div class="specs">
            <span
              ><strong>Form:</strong>
              {{ chassis.specifications.formFactor }}</span
            >
            <span
              ><strong>Power:</strong>
              {{ chassis.specifications.maxPower }}</span
            >
          </div>
          <div class="price">Starting at \${{ chassis.basePrice }}</div>
          <button class="select-btn">Configure</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .landing-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .landing-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .landing-header h1 {
        font-size: 2.5rem;
        color: #fff;
        margin-bottom: 0.5rem;
      }

      .landing-header p {
        color: #888;
        font-size: 1.1rem;
      }

      .chassis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
      }

      .chassis-card {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .chassis-card:hover {
        border-color: #4a9eff;
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(74, 158, 255, 0.15);
      }

      .chassis-icon {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }

      .type-xs {
        background: #2d5a27;
        color: #7fff7f;
      }
      .type-s {
        background: #3d5a87;
        color: #7fbfff;
      }
      .type-m {
        background: #5a3d87;
        color: #bf7fff;
      }
      .type-l {
        background: #875727;
        color: #ffbf7f;
      }

      .chassis-card h3 {
        color: #fff;
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
      }

      .use-case {
        color: #4a9eff;
        font-size: 0.75rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
      }

      .description {
        color: #888;
        font-size: 0.9rem;
        margin-bottom: 1rem;
        line-height: 1.4;
      }

      .specs {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: #666;
        margin-bottom: 1rem;
      }

      .price {
        color: #4ade80;
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }

      .select-btn {
        width: 100%;
        padding: 0.75rem;
        background: #4a9eff;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }

      .select-btn:hover {
        background: #3a8eef;
      }
    `,
  ],
})
export class LandingComponent implements OnInit {
  chassisList: Chassis[] = [];
  loading = true;

  constructor(
    private hardwareService: HardwareService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.hardwareService.getChassis().subscribe({
      next: (chassis) => {
        this.chassisList = chassis;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load chassis:', err);
        this.loading = false;
      },
    });
  }

  selectChassis(chassis: Chassis): void {
    const config = {
      chassisId: chassis.id,
      chassisType: chassis.type,
      useCase: chassis.useCase,
    };
    localStorage.setItem('hw_config', JSON.stringify(config));
    this.router.navigate(['/configure', chassis.id]);
  }
}
