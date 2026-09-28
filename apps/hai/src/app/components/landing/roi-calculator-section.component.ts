import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  HardwareCatalogService,
  HardwareTier,
} from '../../services/hardware-catalog.service';
import {
  RoiAcquisition,
  RoiCalculatorService,
  RoiComparisonResult,
} from '../../services/roi-calculator.service';

@Component({
  selector: 'hai-roi-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="roi-panel" aria-labelledby="roi-heading">
      <p class="eyebrow">Five-year ownership math</p>
      <h2 id="roi-heading">Turnkey appliance or cloud SaaS?</h2>
      <p class="lede">
        Compare five years of an HAI turnkey appliance against your current
        cloud software spend. Every assumption is shown under the figures.
      </p>

      <div class="roi-grid">
        <div class="roi-inputs">
          <label class="input-label" for="roiTier">Hardware tier</label>
          <select
            id="roiTier"
            class="roi-select"
            [(ngModel)]="selectedTierId"
            (ngModelChange)="recalculate()"
          >
            <option *ngFor="let tier of tiers" [value]="tier.id">
              {{ tier.name }}
            </option>
          </select>

          <fieldset class="acquisition-group">
            <legend class="input-label">Acquisition</legend>
            <label class="radio-option">
              <input
                type="radio"
                name="acquisition"
                value="outright"
                [(ngModel)]="acquisition"
                (ngModelChange)="recalculate()"
              />
              Outright purchase
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="acquisition"
                value="lease-24"
                [(ngModel)]="acquisition"
                (ngModelChange)="recalculate()"
              />
              24-month lease
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="acquisition"
                value="lease-36"
                [(ngModel)]="acquisition"
                (ngModelChange)="recalculate()"
              />
              36-month lease
            </label>
          </fieldset>

          <label class="input-label" for="roiSpend">
            Current monthly cloud spend (USD)
          </label>
          <input
            id="roiSpend"
            type="number"
            min="0"
            step="10"
            class="roi-input"
            [(ngModel)]="monthlySpend"
            (ngModelChange)="recalculate()"
          />

          <label class="input-label" for="roiUplift">
            Expected annual SaaS price uplift (%)
          </label>
          <input
            id="roiUplift"
            type="number"
            min="0"
            max="100"
            step="1"
            class="roi-input"
            [(ngModel)]="annualUplift"
            (ngModelChange)="recalculate()"
          />
        </div>

        <div class="roi-results" aria-live="polite">
          <div *ngIf="formError" class="error-banner" role="alert">
            {{ formError }}
          </div>

          <div *ngIf="result" class="result-cards">
            <div class="result-card">
              <span class="result-label">HAI turnkey, 5 years</span>
              <strong class="result-value">{{ money(result.haiTotal) }}</strong>
              <span class="result-meta">
                Hardware {{ money(result.haiHardwareTotal) }} · Service
                {{ money(result.haiServiceTotal) }}
              </span>
            </div>
            <div class="result-card">
              <span class="result-label">Cloud SaaS, 5 years</span>
              <strong class="result-value">{{
                money(result.cloudTotal)
              }}</strong>
            </div>
            <div
              class="result-card"
              [class.savings-positive]="result.savings > 0"
            >
              <span class="result-label">Five-year savings</span>
              <strong class="result-value">{{ money(result.savings) }}</strong>
              <span class="result-meta">
                <ng-container *ngIf="result.breakEvenMonth !== null">
                  Break-even in month {{ result.breakEvenMonth }}
                </ng-container>
                <ng-container *ngIf="result.breakEvenMonth === null">
                  Cloud stays cheaper across five years
                </ng-container>
              </span>
            </div>
          </div>

          <table *ngIf="result" class="yearly-table">
            <caption class="sr-only">
              Year-by-year cumulative cost comparison
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">HAI cumulative</th>
                <th scope="col">Cloud cumulative</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of result.yearly">
                <td>{{ row.year }}</td>
                <td>{{ money(row.haiCumulative) }}</td>
                <td>{{ money(row.cloudCumulative) }}</td>
              </tr>
            </tbody>
          </table>

          <ul *ngIf="result" class="assumptions-list">
            <li *ngFor="let assumption of result.assumptions">
              {{ assumption }}
            </li>
          </ul>

          <button
            *ngIf="result"
            type="button"
            class="btn-email"
            (click)="requestEmailComparison()"
          >
            Email me this comparison
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .roi-panel {
        max-width: 1100px;
        margin: 0 auto;
        padding: 48px 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--accent, #0ea5e9);
        margin: 0 0 8px 0;
      }
      h2 {
        font-size: 1.9rem;
        margin: 0 0 10px 0;
      }
      .lede {
        color: var(--foreground-muted, #475569);
        max-width: 640px;
        margin: 0 0 24px 0;
        line-height: 1.6;
      }
      .roi-grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 28px;
      }
      @media (max-width: 800px) {
        .roi-grid {
          grid-template-columns: 1fr;
        }
      }
      .input-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        margin: 14px 0 6px 0;
      }
      .roi-select,
      .roi-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 1rem;
        border: 2px solid var(--border-color, #94a3b8);
        border-radius: 6px;
      }
      .acquisition-group {
        border: none;
        padding: 0;
        margin: 0;
      }
      .radio-option {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 6px 0;
        font-size: 0.95rem;
      }
      .error-banner {
        background: #fef2f2;
        border: 2px solid #b91c1c;
        color: #b91c1c;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 14px;
        font-weight: 600;
      }
      .result-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 18px;
      }
      @media (max-width: 700px) {
        .result-cards {
          grid-template-columns: 1fr;
        }
      }
      .result-card {
        border: 1px solid var(--border-color, #94a3b8);
        border-radius: 10px;
        padding: 14px;
      }
      .savings-positive {
        border-color: #15803d;
        border-width: 2px;
      }
      .result-label {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--foreground-muted, #475569);
        margin-bottom: 4px;
      }
      .result-value {
        display: block;
        font-size: 1.4rem;
      }
      .result-meta {
        display: block;
        font-size: 0.8rem;
        color: var(--foreground-muted, #475569);
        margin-top: 4px;
      }
      .yearly-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
        font-size: 0.9rem;
      }
      .yearly-table th,
      .yearly-table td {
        text-align: right;
        padding: 8px 10px;
        border-bottom: 1px solid var(--border-color, #94a3b8);
      }
      .yearly-table th:first-child,
      .yearly-table td:first-child {
        text-align: left;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .assumptions-list {
        font-size: 0.85rem;
        color: var(--foreground-muted, #475569);
        margin: 0 0 16px 0;
        padding-left: 20px;
        line-height: 1.6;
      }
      .btn-email {
        background: var(--primary, #1d4ed8);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 12px 20px;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ],
})
export class RoiCalculatorSectionComponent implements OnInit {
  @Output() readonly emailComparison = new EventEmitter<string>();

  tiers: HardwareTier[] = [];
  selectedTierId = 'tier1';
  acquisition: RoiAcquisition = 'outright';
  monthlySpend: number | null = 200;
  annualUplift: number | null = 8;
  result: RoiComparisonResult | null = null;
  formError = '';

  constructor(
    private readonly catalog: HardwareCatalogService,
    private readonly roi: RoiCalculatorService
  ) {}

  ngOnInit(): void {
    this.catalog.getTiers().subscribe({
      next: (tiers) => {
        this.tiers = tiers ?? [];
        if (!this.tiers.some((tier) => tier.id === this.selectedTierId)) {
          this.selectedTierId = this.tiers[0]?.id ?? '';
        }
        this.recalculate();
      },
      error: () => {
        this.formError =
          'Hardware tiers are unavailable. The comparison cannot load.';
      },
    });
  }

  recalculate(): void {
    this.formError = '';
    const tier = this.tiers.find((entry) => entry.id === this.selectedTierId);
    if (!tier) {
      this.result = null;
      return;
    }
    if (
      this.monthlySpend === null ||
      !Number.isFinite(this.monthlySpend) ||
      this.monthlySpend < 0
    ) {
      this.result = null;
      this.formError = 'Current monthly spend must be zero or positive.';
      return;
    }
    if (
      this.annualUplift === null ||
      !Number.isFinite(this.annualUplift) ||
      this.annualUplift < 0 ||
      this.annualUplift > 100
    ) {
      this.result = null;
      this.formError = 'Annual uplift must be between 0 and 100 percent.';
      return;
    }
    try {
      this.result = this.roi.compare({
        tier: {
          id: tier.id,
          name: tier.name,
          retailPrice: tier.retailPrice,
          leaseMonthlyRate: tier.leaseMonthlyRate,
          softwareMonthlyRate: tier.softwareMonthlyRate ?? 0,
          retainerMonthlyRate: tier.retainerMonthlyRate ?? 0,
        },
        acquisition: this.acquisition,
        currentMonthlySpend: this.monthlySpend,
        annualUpliftPercent: this.annualUplift,
      });
    } catch (error) {
      this.result = null;
      this.formError =
        error instanceof Error ? error.message : 'Invalid comparison inputs.';
    }
  }

  money(value: number): string {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  }

  requestEmailComparison(): void {
    if (!this.result) {
      return;
    }
    const tier = this.tiers.find((entry) => entry.id === this.selectedTierId);
    const lines = [
      `Please send me the five-year comparison for the ${
        tier?.name ?? 'selected tier'
      } (${this.acquisition}).`,
      `HAI turnkey five-year total: ${this.money(this.result.haiTotal)}.`,
      `Cloud SaaS five-year total: ${this.money(this.result.cloudTotal)}.`,
      `Five-year savings: ${this.money(this.result.savings)}.`,
      this.result.breakEvenMonth !== null
        ? `Break-even in month ${this.result.breakEvenMonth}.`
        : 'No break-even inside five years.',
      ...this.result.assumptions.map((assumption) => `Assumes: ${assumption}`),
    ];
    this.emailComparison.emit(lines.join('\n'));
  }
}
