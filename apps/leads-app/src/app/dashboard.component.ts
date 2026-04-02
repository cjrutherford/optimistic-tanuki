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
  statsLoaded = false;
  topicsLoaded = false;

  statusBars: Array<{
    name: string;
    key: string;
    count: number;
    value: number;
    percentage: number;
  }> = [];

  activeTopics = 0;
  totalTopics = 0;

  ngOnInit() {
    this.loadStats();
    this.themeService.setPersonality('control-center');
    this.loadActiveTopicCount();
  }

  loadStats() {
    this.leadsService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.statsLoaded = true;
        this.calculateStatusBars();
        this.loading = false;
      },
      error: () => {
        this.statsLoaded = true;
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

  get strongMatchCount(): number {
    return this.stats?.qualification?.byClassification?.['strong-match'] || 0;
  }

  get reviewCount(): number {
    return this.stats?.qualification?.byClassification?.review || 0;
  }

  get weakMatchCount(): number {
    return this.stats?.qualification?.byClassification?.['weak-match'] || 0;
  }

  shouldShowOnboardingState(): boolean {
    return (
      this.statsLoaded &&
      this.topicsLoaded &&
      (this.stats?.total || 0) === 0 &&
      this.totalTopics === 0
    );
  }

  private loadActiveTopicCount() {
    this.leadsService.getTopics().subscribe({
      next: (topics) => {
        this.topicsLoaded = true;
        this.totalTopics = topics.length;
        this.activeTopics = topics.filter((topic) => topic.enabled).length;
      },
      error: () => {
        this.topicsLoaded = true;
      },
    });
  }
}
