import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LeadsService } from './leads.service';
import { LeadStats } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly themeService = inject(ThemeService);

  stats: LeadStats | null = null;
  loading = true;

  statusBars: Array<{
    name: string;
    key: string;
    count: number;
    value: number;
    percentage: number;
  }> = [];

  activeTopics = 0;

  ngOnInit() {
    this.loadStats();
    this.themeService.setPersonality('control-center');
    this.activeTopics = this.leadsService.getActiveTopicCount();
  }

  loadStats() {
    this.leadsService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.calculateStatusBars();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  calculateStatusBars() {
    if (!this.stats) return;

    const byStatus = this.stats.byStatus || {};
    const total = this.stats.total || 1;
    const statusOrder = [
      'new',
      'contacted',
      'qualified',
      'proposal',
      'negotiation',
      'won',
      'lost',
    ];

    this.statusBars = statusOrder
      .filter((key) => byStatus[key])
      .map((key) => ({
        name: key,
        key,
        count: byStatus[key] || 0,
        value: 0,
        percentage: ((byStatus[key] || 0) / total) * 100,
      }));
  }

  getWinRate(): number {
    if (!this.stats) return 0;
    const won = this.stats.byStatus?.['won'] || 0;
    const total = this.stats.total || 1;
    return Math.round((won / total) * 100);
  }
}
