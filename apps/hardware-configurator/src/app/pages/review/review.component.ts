import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  HardwareService,
  Chassis,
  Component as HWComponent,
  CompatibleComponents,
  PriceBreakdown,
  ConfigurationDto,
} from '../../services/hardware.service';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="review-container">
      <header class="review-header">
        <button class="back-btn" (click)="goBack()">← Back to Configure</button>
        <h1>Review Your Configuration</h1>
      </header>

      <div class="review-grid" *ngIf="chassis">
        <div class="config-summary">
          <div class="summary-section">
            <h3>Chassis</h3>
            <div class="summary-item">
              <span class="label">Model:</span>
              <span class="value">{{ chassis.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Type:</span>
              <span class="value"
                >{{ chassis.type }} - {{ chassis.useCase }}</span
              >
            </div>
            <div class="summary-item">
              <span class="label">Form Factor:</span>
              <span class="value">{{ chassis.specifications.formFactor }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Max Power:</span>
              <span class="value">{{ chassis.specifications.maxPower }}</span>
            </div>
          </div>

          <div class="summary-section" *ngIf="cpu">
            <h3>Processor</h3>
            <div class="summary-item">
              <span class="label">CPU:</span>
              <span class="value">{{ cpu.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Specs:</span>
              <span class="value"
                >{{ cpu.specs['cores'] }} cores @
                {{ cpu.specs['frequency'] }}</span
              >
            </div>
          </div>

          <div class="summary-section" *ngIf="ram">
            <h3>Memory</h3>
            <div class="summary-item">
              <span class="label">RAM:</span>
              <span class="value">{{ ram.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Specs:</span>
              <span class="value"
                >{{ ram.specs['capacity'] }} {{ ram.specs['speed'] }}</span
              >
            </div>
          </div>

          <div class="summary-section" *ngIf="storages.length">
            <h3>Storage</h3>
            <div class="summary-item" *ngFor="let s of storages">
              <span class="label">{{ s.name }}:</span>
              <span class="value"
                >{{ s.specs['capacity'] }} {{ s.specs['type'] }}</span
              >
            </div>
          </div>

          <div class="summary-section" *ngIf="gpu">
            <h3>Graphics</h3>
            <div class="summary-item">
              <span class="label">GPU:</span>
              <span class="value">{{ gpu.name }}</span>
            </div>
            <div class="summary-item">
              <span class="label">VRAM:</span>
              <span class="value">{{ gpu.specs['vram'] }}</span>
            </div>
          </div>
        </div>

        <div class="price-card">
          <h3>Price Breakdown</h3>
          <div class="price-row" *ngIf="priceBreakdown">
            <span>Chassis</span>
            <span>\${{ priceBreakdown.chassisPrice }}</span>
          </div>
          <div class="price-row" *ngIf="priceBreakdown">
            <span>CPU</span>
            <span>\${{ priceBreakdown.cpuPrice }}</span>
          </div>
          <div class="price-row" *ngIf="priceBreakdown">
            <span>RAM</span>
            <span>\${{ priceBreakdown.ramPrice }}</span>
          </div>
          <div class="price-row" *ngIf="priceBreakdown">
            <span>Storage</span>
            <span>\${{ priceBreakdown.storagePrice }}</span>
          </div>
          <div
            class="price-row"
            *ngIf="priceBreakdown && priceBreakdown.gpuPrice > 0"
          >
            <span>GPU</span>
            <span>\${{ priceBreakdown.gpuPrice }}</span>
          </div>
          <div class="price-row" *ngIf="priceBreakdown">
            <span>Assembly</span>
            <span>\${{ priceBreakdown.assemblyFee }}</span>
          </div>
          <div class="price-row total">
            <span>Total</span>
            <span>\${{ priceBreakdown?.totalPrice || 0 }}</span>
          </div>

          <button class="checkout-btn" (click)="goToCheckout()">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .review-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .review-header {
        margin-bottom: 2rem;
      }

      .back-btn {
        background: none;
        border: 1px solid #444;
        color: #888;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 1rem;
      }

      .back-btn:hover {
        border-color: #4a9eff;
        color: #4a9eff;
      }

      .review-header h1 {
        color: #fff;
        margin: 0;
      }

      .review-grid {
        display: grid;
        grid-template-columns: 1fr 350px;
        gap: 2rem;
      }

      @media (max-width: 768px) {
        .review-grid {
          grid-template-columns: 1fr;
        }
      }

      .config-summary {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .summary-section {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 1.25rem;
      }

      .summary-section h3 {
        color: #4a9eff;
        font-size: 0.9rem;
        text-transform: uppercase;
        margin: 0 0 1rem 0;
      }

      .summary-item {
        display: flex;
        justify-content: space-between;
        padding: 0.4rem 0;
        border-bottom: 1px solid #2a2a2a;
      }

      .summary-item:last-child {
        border-bottom: none;
      }

      .summary-item .label {
        color: #666;
      }

      .summary-item .value {
        color: #fff;
        font-weight: 500;
      }

      .price-card {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 1.5rem;
        height: fit-content;
        position: sticky;
        top: 2rem;
      }

      .price-card h3 {
        color: #fff;
        margin: 0 0 1.5rem 0;
      }

      .price-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        color: #888;
      }

      .price-row.total {
        border-top: 1px solid #333;
        margin-top: 0.5rem;
        padding-top: 1rem;
        color: #fff;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .price-row.total span:last-child {
        color: #4ade80;
      }

      .checkout-btn {
        width: 100%;
        margin-top: 1.5rem;
        padding: 1rem;
        background: #4a9eff;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      }

      .checkout-btn:hover {
        background: #3a8eef;
      }
    `,
  ],
})
export class ReviewComponent implements OnInit {
  chassis: Chassis | null = null;
  cpu: HWComponent | null = null;
  ram: HWComponent | null = null;
  storages: HWComponent[] = [];
  gpu: HWComponent | null = null;
  priceBreakdown: PriceBreakdown | null = null;

  constructor(
    private router: Router,
    private hardwareService: HardwareService
  ) {}

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    const saved = localStorage.getItem('hw_config');
    if (!saved) {
      this.router.navigate(['/']);
      return;
    }

    const config = JSON.parse(saved) as ConfigurationDto;

    this.hardwareService.getChassisById(config.chassisId).subscribe({
      next: (chassis) => {
        this.chassis = chassis;
        this.loadComponents(config);
      },
    });
  }

  loadComponents(config: ConfigurationDto): void {
    this.hardwareService.getCompatibleComponents(config.chassisId).subscribe({
      next: (compat) => {
        this.cpu = compat.cpu.find((c) => c.id === config.cpuId) || null;
        this.ram = compat.ram.find((c) => c.id === config.ramId) || null;
        this.storages = compat.storage.filter((s) =>
          config.storageIds.includes(s.id)
        );
        this.gpu = config.gpuId
          ? compat.gpu.find((g) => g.id === config.gpuId) || null
          : null;
        this.calculatePrice(config);
      },
    });
  }

  calculatePrice(config: ConfigurationDto): void {
    this.hardwareService.calculatePrice(config).subscribe({
      next: (price) => (this.priceBreakdown = price),
    });
  }

  goBack(): void {
    this.router.navigate(['/configure', this.chassis?.id]);
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }
}
