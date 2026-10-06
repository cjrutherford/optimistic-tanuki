import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RoiCalculatorService,
  RoiComparisonResult,
} from '../../services/roi-calculator.service';
import { LABOR_RATE_LABEL, LABOR_RATE_PER_HOUR } from '../../content/pricing';

@Component({
  selector: 'hai-roi-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="roi-panel" aria-labelledby="roi-heading">
      <p class="eyebrow">Five-year math with your numbers</p>
      <h2 id="roi-heading">Check the math for your situation.</h2>
      <p class="lede">
        Enter the figures from your quote and what you pay for subscriptions
        today. Labor uses our published rate of {{ laborRateLabel }}. Every
        assumption is shown under the result, and the result can go either way.
      </p>

      <div class="roi-grid">
        <div class="roi-inputs">
          <label class="input-label" for="roiHardware">
            Hardware cost from your quote (USD)
          </label>
          <input
            id="roiHardware"
            type="number"
            min="0"
            step="10"
            class="roi-input"
            [(ngModel)]="hardwareCost"
            (ngModelChange)="recalculate()"
          />

          <label class="input-label" for="roiSetup">Setup hours</label>
          <input
            id="roiSetup"
            type="number"
            min="0"
            step="1"
            class="roi-input"
            [(ngModel)]="setupHours"
            (ngModelChange)="recalculate()"
          />

          <label class="input-label" for="roiSupport">
            Support hours per month
          </label>
          <input
            id="roiSupport"
            type="number"
            min="0"
            step="0.5"
            class="roi-input"
            [(ngModel)]="monthlySupportHours"
            (ngModelChange)="recalculate()"
          />

          <label class="input-label" for="roiServices">
            Monthly service costs, such as backup storage (USD)
          </label>
          <input
            id="roiServices"
            type="number"
            min="0"
            step="1"
            class="roi-input"
            [(ngModel)]="monthlyServiceCosts"
            (ngModelChange)="recalculate()"
          />

          <label class="input-label" for="roiSpend">
            What you pay for subscriptions now, per month (USD)
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
            Yearly subscription price increase, if any (%)
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

          <p *ngIf="!result && !formError" class="needs-input">
            Enter the hardware cost and setup hours from your quote, and what
            you pay for subscriptions now. No quote yet? Start an assessment and
            we will send you an itemized one.
          </p>

          <div *ngIf="result" class="result-cards">
            <div class="result-card">
              <span class="result-label">Owned, 5 years</span>
              <strong class="result-value">{{
                money(result.ownedTotal)
              }}</strong>
              <span class="result-meta">
                Hardware {{ money(result.ownedHardwareTotal) }} · Labor
                {{ money(result.ownedLaborTotal) }} · Services
                {{ money(result.ownedServiceCostTotal) }}
              </span>
            </div>
            <div class="result-card">
              <span class="result-label">Subscriptions, 5 years</span>
              <strong class="result-value">{{
                money(result.cloudTotal)
              }}</strong>
            </div>
            <div class="result-card">
              <span class="result-label">Difference over 5 years</span>
              <strong class="result-value">{{ outcome(result) }}</strong>
              <span class="result-meta">
                <ng-container *ngIf="result.breakEvenMonth !== null">
                  Owning catches up in month {{ result.breakEvenMonth }}
                </ng-container>
                <ng-container *ngIf="result.breakEvenMonth === null">
                  Subscriptions stay cheaper across five years
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
                <th scope="col">Owned, cumulative</th>
                <th scope="col">Subscriptions, cumulative</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of result.yearly">
                <td>{{ row.year }}</td>
                <td>{{ money(row.ownedCumulative) }}</td>
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
            Send this comparison with my question
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
        color: var(--accent, var(--primary));
        margin: 0 0 8px 0;
      }
      h2 {
        font-size: 1.9rem;
        margin: 0 0 10px 0;
      }
      .lede {
        color: var(--foreground-muted, var(--muted));
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
      .roi-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 1rem;
        border: 2px solid var(--border, var(--primary));
        border-radius: 6px;
      }
      .error-banner {
        background: color-mix(in srgb, var(--danger) 8%, var(--surface));
        border: 2px solid var(--danger);
        color: var(--danger);
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
        border: 1px solid var(--border, var(--primary));
        border-radius: 10px;
        padding: 14px;
      }
      .result-label {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--foreground-muted, var(--muted));
        margin-bottom: 4px;
      }
      .result-value {
        display: block;
        font-size: 1.4rem;
      }
      .result-meta {
        display: block;
        font-size: 0.8rem;
        color: var(--foreground-muted, var(--muted));
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
        border-bottom: 1px solid var(--border, var(--primary));
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
        color: var(--foreground-muted, var(--muted));
        margin: 0 0 16px 0;
        padding-left: 20px;
        line-height: 1.6;
      }
      .needs-input {
        margin: 0;
        line-height: 1.6;
      }
      .btn-email {
        background: var(--primary);
        color: var(--on-primary, var(--primary-foreground));
        border: none;
        border-radius: 6px;
        padding: 12px 20px;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ],
})
export class RoiCalculatorSectionComponent {
  @Output() readonly emailComparison = new EventEmitter<string>();

  readonly laborRateLabel = LABOR_RATE_LABEL;
  hardwareCost: number | null = null;
  setupHours: number | null = null;
  monthlySupportHours: number | null = 0;
  monthlyServiceCosts: number | null = 0;
  monthlySpend: number | null = null;
  annualUplift: number | null = 0;
  result: RoiComparisonResult | null = null;
  formError = '';

  constructor(private readonly roi: RoiCalculatorService) {}

  recalculate(): void {
    this.formError = '';
    this.result = null;
    const required = [this.hardwareCost, this.setupHours, this.monthlySpend];
    if (required.some((value) => value === null || value === undefined)) {
      return;
    }
    try {
      this.result = this.roi.compare({
        hardwareCost: this.hardwareCost as number,
        setupHours: this.setupHours as number,
        monthlySupportHours: this.monthlySupportHours ?? 0,
        monthlyServiceCosts: this.monthlyServiceCosts ?? 0,
        laborRatePerHour: LABOR_RATE_PER_HOUR,
        currentMonthlySpend: this.monthlySpend as number,
        annualUpliftPercent: this.annualUplift ?? 0,
      });
    } catch (error) {
      this.formError =
        error instanceof Error ? error.message : 'Invalid comparison inputs.';
    }
  }

  outcome(result: RoiComparisonResult): string {
    if (result.difference === 0) {
      return 'About the same';
    }
    return result.difference > 0
      ? `Owning costs ${this.money(result.difference)} less`
      : `Subscriptions cost ${this.money(-result.difference)} less`;
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
    const lines = [
      'Please check this five-year comparison against a quote for my situation.',
      `Owned, five-year total: ${this.money(this.result.ownedTotal)}.`,
      `Subscriptions, five-year total: ${this.money(this.result.cloudTotal)}.`,
      `Difference: ${this.outcome(this.result)}.`,
      this.result.breakEvenMonth !== null
        ? `Owning catches up in month ${this.result.breakEvenMonth}.`
        : 'Subscriptions stay cheaper across five years.',
      ...this.result.assumptions.map((assumption) => `Assumes: ${assumption}`),
    ];
    this.emailComparison.emit(lines.join('\n'));
  }
}
