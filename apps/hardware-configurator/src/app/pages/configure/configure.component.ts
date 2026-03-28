import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  HardwareService,
  Chassis,
  Component as HWComponent,
  CompatibleComponents,
  PriceBreakdown,
} from '../../services/hardware.service';

interface ConfigState {
  chassisId: string;
  chassisType: string;
  useCase: string;
  cpuId: string;
  ramId: string;
  storageIds: string[];
  gpuId?: string;
}

@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="configure-container">
      <header class="configure-header">
        <button class="back-btn" (click)="goBack()">← Back</button>
        <h1>Configure Your {{ chassis?.name }}</h1>
        <p>{{ chassis?.description }}</p>
      </header>

      <div class="config-sections" *ngIf="compatible">
        <!-- CPU Selection -->
        <section class="config-section">
          <h2>Processor (CPU)</h2>
          <div class="component-grid">
            <div
              *ngFor="let cpu of compatible.cpu"
              class="component-card"
              [class.selected]="selectedCpu?.id === cpu.id"
              (click)="selectCpu(cpu)"
            >
              <h4>{{ cpu.name }}</h4>
              <p class="specs">
                {{ cpu.specs['cores'] }} cores, {{ cpu.specs['frequency'] }}
              </p>
              <p class="price">\${{ cpu.sellingPrice }}</p>
            </div>
          </div>
        </section>

        <!-- RAM Selection -->
        <section class="config-section">
          <h2>Memory (RAM)</h2>
          <div class="component-grid">
            <div
              *ngFor="let ram of compatible.ram"
              class="component-card"
              [class.selected]="selectedRam?.id === ram.id"
              (click)="selectRam(ram)"
            >
              <h4>{{ ram.name }}</h4>
              <p class="specs">
                {{ ram.specs['capacity'] }}, {{ ram.specs['speed'] }}
              </p>
              <p class="price">\${{ ram.sellingPrice }}</p>
            </div>
          </div>
        </section>

        <!-- Storage Selection -->
        <section class="config-section">
          <h2>Storage</h2>
          <div class="component-grid">
            <div
              *ngFor="let storage of compatible.storage"
              class="component-card"
              [class.selected]="selectedStorage.includes(storage.id)"
              (click)="toggleStorage(storage)"
            >
              <h4>{{ storage.name }}</h4>
              <p class="specs">
                {{ storage.specs['capacity'] }}, {{ storage.specs['type'] }}
              </p>
              <p class="price">\${{ storage.sellingPrice }}</p>
            </div>
          </div>
        </section>

        <!-- GPU Selection -->
        <section class="config-section">
          <h2>Graphics (GPU) - Optional</h2>
          <div class="component-grid">
            <div
              *ngFor="let gpu of compatible.gpu"
              class="component-card"
              [class.selected]="selectedGpu?.id === gpu.id"
              (click)="selectGpu(gpu)"
            >
              <h4>{{ gpu.name }}</h4>
              <p class="specs">{{ gpu.specs['vram'] }} VRAM</p>
              <p class="price">
                {{ gpu.sellingPrice > 0 ? '$' + gpu.sellingPrice : 'Included' }}
              </p>
            </div>
          </div>
        </section>

        <!-- Price Summary -->
        <div class="price-summary">
          <div class="summary-row">
            <span>Chassis</span>
            <span>\${{ chassis?.basePrice || 0 }}</span>
          </div>
          <div class="summary-row" *ngIf="selectedCpu">
            <span>CPU</span>
            <span>\${{ selectedCpu.sellingPrice }}</span>
          </div>
          <div class="summary-row" *ngIf="selectedRam">
            <span>RAM</span>
            <span>\${{ selectedRam.sellingPrice }}</span>
          </div>
          <div class="summary-row" *ngIf="selectedStorage.length">
            <span>Storage</span>
            <span>\${{ getStorageTotal() }}</span>
          </div>
          <div class="summary-row" *ngIf="selectedGpu">
            <span>GPU</span>
            <span>\${{ selectedGpu.sellingPrice }}</span>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <span>\${{ currentTotal }}</span>
          </div>
          <button
            class="continue-btn"
            [disabled]="!isValid()"
            (click)="goToReview()"
          >
            Continue to Review
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .configure-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .configure-header {
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

      .configure-header h1 {
        color: #fff;
        margin: 0 0 0.5rem 0;
      }

      .configure-header p {
        color: #888;
        margin: 0;
      }

      .config-section {
        margin-bottom: 2rem;
      }

      .config-section h2 {
        color: #fff;
        font-size: 1.25rem;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #333;
      }

      .component-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1rem;
      }

      .component-card {
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .component-card:hover {
        border-color: #555;
      }

      .component-card.selected {
        border-color: #4a9eff;
        background: #1a2a3a;
      }

      .component-card h4 {
        color: #fff;
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
      }

      .component-card .specs {
        color: #888;
        font-size: 0.85rem;
        margin: 0 0 0.5rem 0;
      }

      .component-card .price {
        color: #4ade80;
        font-weight: 600;
        margin: 0;
      }

      .price-summary {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 1.5rem;
        margin-top: 2rem;
      }

      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        color: #888;
      }

      .summary-row.total {
        border-top: 1px solid #333;
        margin-top: 0.5rem;
        padding-top: 1rem;
        color: #fff;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .summary-row.total span:last-child {
        color: #4ade80;
      }

      .continue-btn {
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
        transition: background 0.2s;
      }

      .continue-btn:hover:not(:disabled) {
        background: #3a8eef;
      }

      .continue-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ConfigureComponent implements OnInit {
  chassis: Chassis | null = null;
  compatible: CompatibleComponents | null = null;

  selectedCpu: HWComponent | null = null;
  selectedRam: HWComponent | null = null;
  selectedStorage: string[] = [];
  selectedGpu: HWComponent | null = null;

  currentTotal = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hardwareService: HardwareService
  ) {}

  ngOnInit(): void {
    const chassisId = this.route.snapshot.paramMap.get('chassisId');
    if (!chassisId) {
      this.router.navigate(['/']);
      return;
    }

    this.loadChassis(chassisId);
    this.loadCompatible(chassisId);
    this.loadSavedConfig();
  }

  loadChassis(id: string): void {
    this.hardwareService.getChassisById(id).subscribe({
      next: (chassis) => (this.chassis = chassis),
    });
  }

  loadCompatible(id: string): void {
    this.hardwareService.getCompatibleComponents(id).subscribe({
      next: (compat) => {
        this.compatible = compat;
        this.autoSelectDefaults();
      },
    });
  }

  loadSavedConfig(): void {
    const saved = localStorage.getItem('hw_config');
    if (saved) {
      const config = JSON.parse(saved) as ConfigState;
      if (config.cpuId) {
        this.selectedCpu =
          this.compatible?.cpu.find((c) => c.id === config.cpuId) || null;
      }
      if (config.ramId) {
        this.selectedRam =
          this.compatible?.ram.find((c) => c.id === config.ramId) || null;
      }
      if (config.storageIds) {
        this.selectedStorage = config.storageIds;
      }
      if (config.gpuId) {
        this.selectedGpu =
          this.compatible?.gpu.find((c) => c.id === config.gpuId) || null;
      }
      this.calculateTotal();
    }
  }

  autoSelectDefaults(): void {
    if (this.compatible && !this.selectedCpu && this.compatible.cpu.length) {
      this.selectedCpu = this.compatible.cpu[0];
    }
    if (this.compatible && !this.selectedRam && this.compatible.ram.length) {
      this.selectedRam = this.compatible.ram[0];
    }
    if (
      this.compatible &&
      !this.selectedStorage.length &&
      this.compatible.storage.length
    ) {
      this.selectedStorage = [this.compatible.storage[0].id];
    }
    if (this.compatible && !this.selectedGpu && this.compatible.gpu.length) {
      this.selectedGpu = this.compatible.gpu[0];
    }
    this.calculateTotal();
  }

  selectCpu(cpu: HWComponent): void {
    this.selectedCpu = cpu;
    this.calculateTotal();
    this.saveConfig();
  }

  selectRam(ram: HWComponent): void {
    this.selectedRam = ram;
    this.calculateTotal();
    this.saveConfig();
  }

  toggleStorage(storage: HWComponent): void {
    const idx = this.selectedStorage.indexOf(storage.id);
    if (idx >= 0) {
      this.selectedStorage.splice(idx, 1);
    } else {
      this.selectedStorage.push(storage.id);
    }
    this.calculateTotal();
    this.saveConfig();
  }

  selectGpu(gpu: HWComponent): void {
    this.selectedGpu = gpu;
    this.calculateTotal();
    this.saveConfig();
  }

  getStorageTotal(): number {
    if (!this.compatible) return 0;
    return this.selectedStorage.reduce((sum, id) => {
      const storage = this.compatible!.storage.find((s) => s.id === id);
      return sum + (storage ? Number(storage.sellingPrice) : 0);
    }, 0);
  }

  calculateTotal(): void {
    let total = this.chassis?.basePrice || 0;
    if (this.selectedCpu) total += Number(this.selectedCpu.sellingPrice);
    if (this.selectedRam) total += Number(this.selectedRam.sellingPrice);
    total += this.getStorageTotal();
    if (this.selectedGpu) total += Number(this.selectedGpu.sellingPrice);
    this.currentTotal = Math.round(total * 100) / 100;
  }

  isValid(): boolean {
    return !!(
      this.selectedCpu &&
      this.selectedRam &&
      this.selectedStorage.length
    );
  }

  saveConfig(): void {
    const config: ConfigState = {
      chassisId: this.chassis?.id || '',
      chassisType: this.chassis?.type || '',
      useCase: this.chassis?.useCase || '',
      cpuId: this.selectedCpu?.id || '',
      ramId: this.selectedRam?.id || '',
      storageIds: this.selectedStorage,
      gpuId: this.selectedGpu?.id,
    };
    localStorage.setItem('hw_config', JSON.stringify(config));
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  goToReview(): void {
    this.saveConfig();
    this.router.navigate(['/review']);
  }
}
