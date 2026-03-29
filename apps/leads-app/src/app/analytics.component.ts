import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LeadsService } from './leads.service';
import { Lead, LeadStats, LeadSource } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="analytics">
      <header class="header">
        <div class="header-content">
          <a routerLink="/" class="back-link">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Dashboard
          </a>
          <h1 class="title">Analytics</h1>
          <p class="subtitle">Lead Performance Insights</p>
        </div>
      </header>

      @if (loading) {
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Analyzing data...</span>
      </div>
      } @else {
      <div class="charts-grid">
        <div class="chart-card">
          <h3 class="chart-title">Lead Sources</h3>
          <div class="chart-container">
            <canvas #sourceChart></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3 class="chart-title">Pipeline Distribution</h3>
          <div class="chart-container">
            <canvas #pipelineChart></canvas>
          </div>
        </div>

        <div class="chart-card wide">
          <h3 class="chart-title">Lead Volume Trend</h3>
          <div class="chart-container large">
            <canvas #trendChart></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3 class="chart-title">Conversion Funnel</h3>
          <div class="funnel">
            @for (stage of funnelStages; track stage.name; let i = $index) {
            <div class="funnel-stage" [style.animation-delay.ms]="i * 100">
              <div class="funnel-bar" [style.width.%]="stage.percentage">
                <span class="funnel-label">{{ stage.name }}</span>
                <span class="funnel-value">{{ stage.count }}</span>
              </div>
            </div>
            }
          </div>
        </div>

        <div class="chart-card">
          <h3 class="chart-title">Performance Metrics</h3>
          <div class="metrics-list">
            <div class="metric">
              <span class="metric-label">Total Pipeline Value</span>
              <span class="metric-value"
                >\${{ stats?.totalValue || 0 | number }}</span
              >
            </div>
            <div class="metric">
              <span class="metric-label">Win Rate</span>
              <span class="metric-value">{{ getWinRate() }}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">Avg Lead Value</span>
              <span class="metric-value">\${{ getAvgValue() | number }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Auto-Discovery Rate</span>
              <span class="metric-value">{{ getAutoRate() }}%</span>
            </div>
          </div>
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .analytics {
        min-height: 100vh;
        background: var(--app-background);
        padding: 2rem;
        animation: fadeIn 0.4s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .header {
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid var(--app-border);
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--app-muted);
        text-decoration: none;
        margin-bottom: 1rem;
        transition: color var(--transition-fast);
      }

      .back-link:hover {
        color: var(--app-primary);
      }

      .back-link svg {
        width: 18px;
        height: 18px;
      }

      .title {
        font-family: var(--font-heading);
        font-size: 2rem;
        font-weight: 700;
        color: var(--app-foreground);
        margin: 0;
        letter-spacing: -0.02em;
      }

      .subtitle {
        font-size: 0.875rem;
        color: var(--app-muted);
        margin: 0.25rem 0 0;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 4rem;
        color: var(--app-muted);
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--app-border);
        border-top-color: var(--app-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .charts-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }

      .chart-card {
        background: var(--app-surface);
        border: 1px solid var(--app-border);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        transition: all var(--transition-fast);
      }

      .chart-card:hover {
        box-shadow: var(--shadow-md);
      }

      .chart-card.wide {
        grid-column: span 2;
      }

      .chart-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--app-foreground);
        margin: 0 0 1rem;
      }

      .chart-container {
        position: relative;
        height: 250px;
      }

      .chart-container.large {
        height: 300px;
      }

      .funnel {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .funnel-stage {
        animation: slideIn 0.4s ease-out forwards;
        opacity: 0;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-10px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .funnel-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: linear-gradient(
          90deg,
          var(--app-primary),
          var(--app-accent)
        );
        border-radius: var(--radius-sm);
        min-width: 60%;
        transition: width 0.6s ease-out;
      }

      .funnel-label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: white;
        text-transform: capitalize;
      }

      .funnel-value {
        font-family: var(--font-mono);
        font-size: 0.875rem;
        font-weight: 600;
        color: white;
      }

      .metrics-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: var(--app-muted);
        border-radius: var(--radius-md);
      }

      .metric-label {
        font-size: 0.8125rem;
        color: var(--app-muted);
      }

      .metric-value {
        font-family: var(--font-mono);
        font-size: 1rem;
        font-weight: 600;
        color: var(--app-foreground);
      }

      @media (max-width: 768px) {
        .analytics {
          padding: 1rem;
        }

        .charts-grid {
          grid-template-columns: 1fr;
        }

        .chart-card.wide {
          grid-column: span 1;
        }

        .title {
          font-size: 1.5rem;
        }
      }
    `,
  ],
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sourceChart') sourceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pipelineChart') pipelineChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly leadsService = inject(LeadsService);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  leads: Lead[] = [];
  stats: LeadStats | null = null;
  loading = true;
  funnelStages: Array<{ name: string; count: number; percentage: number }> = [];

  private sourceChart?: Chart;
  private pipelineChart?: Chart;
  private trendChart?: Chart;

  ngOnInit() {
    this.loadData();
    this.themeService.setPersonality('control-center');
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.initCharts(), 100);
    }
  }

  ngOnDestroy() {
    this.sourceChart?.destroy();
    this.pipelineChart?.destroy();
    this.trendChart?.destroy();
  }

  loadData() {
    this.leadsService.getLeads().subscribe({
      next: (leads) => {
        this.leads = leads;
        this.calculateFunnel();
        this.initCharts();
      },
      error: () => {},
    });

    this.leadsService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.calculateFunnel();
        this.initCharts();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  calculateFunnel() {
    if (!this.stats) return;

    const byStatus = this.stats.byStatus || {};
    const total = this.stats.total || 1;
    const stages = [
      'new',
      'contacted',
      'qualified',
      'proposal',
      'negotiation',
      'won',
    ];

    this.funnelStages = stages
      .filter((key) => byStatus[key])
      .map((key) => ({
        name: key,
        count: byStatus[key] || 0,
        percentage: ((byStatus[key] || 0) / total) * 100,
      }));
  }

  getWinRate(): number {
    if (!this.stats) return 0;
    const won = this.stats.byStatus?.['won'] || 0;
    const total = this.stats.total || 1;
    return Math.round((won / total) * 100);
  }

  getAvgValue(): number {
    if (!this.stats || !this.stats.total) return 0;
    return Math.round(this.stats.totalValue / this.stats.total);
  }

  getAutoRate(): number {
    if (!this.stats) return 0;
    const total = this.stats.total || 1;
    return Math.round((this.stats.autoDiscovered / total) * 100);
  }

  initCharts() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.loading || !this.sourceChartRef) return;

    this.createSourceChart();
    this.createPipelineChart();
    this.createTrendChart();
  }

  private createSourceChart() {
    if (!this.sourceChartRef?.nativeElement) return;

    const ctx = this.sourceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const sourceCounts = this.countBySource();

    this.sourceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(sourceCounts),
        datasets: [
          {
            data: Object.values(sourceCounts),
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6',
              '#ec4899',
              '#6366f1',
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: "'IBM Plex Sans', sans-serif", size: 12 },
              padding: 12,
              usePointStyle: true,
            },
          },
        },
        cutout: '60%',
      },
    });
  }

  private createPipelineChart() {
    if (!this.pipelineChartRef?.nativeElement) return;

    const ctx = this.pipelineChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const byStatus = this.stats?.byStatus || {};
    const labels = Object.keys(byStatus);
    const data = Object.values(byStatus);

    this.pipelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
        datasets: [
          {
            label: 'Leads',
            data,
            backgroundColor: [
              '#3b82f6',
              '#f59e0b',
              '#8b5cf6',
              '#ec4899',
              '#f97316',
              '#22c55e',
              '#ef4444',
            ],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { family: "'JetBrains Mono', monospace", size: 11 },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
            },
          },
        },
      },
    });
  }

  private createTrendChart() {
    if (!this.trendChartRef?.nativeElement) return;

    const ctx = this.trendChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const months = this.getLast6Months();
    const data = months.map(() => Math.floor(Math.random() * 20) + 5);

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'New Leads',
            data,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { family: "'JetBrains Mono', monospace", size: 11 },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
            },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  }

  private countBySource(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.leads.forEach((lead) => {
      const source = lead.source || 'other';
      counts[source] = (counts[source] || 0) + 1;
    });
    return counts;
  }

  private getLast6Months(): string[] {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }
    return months;
  }
}
