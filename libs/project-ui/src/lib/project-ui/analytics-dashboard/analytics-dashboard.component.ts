import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import {
  TaskAnalytics,
  ProjectAnalytics,
  TagAnalytics,
} from '@optimistic-tanuki/ui-models';

/**
 * Analytics Dashboard Component
 * Displays time tracking analytics with visualizations
 */
@Component({
  selector: 'lib-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
})
export class AnalyticsDashboardComponent implements OnInit, OnChanges {
  @Input() projectAnalytics: ProjectAnalytics | null = null;
  @Input() tagAnalytics: TagAnalytics[] = [];

  totalHours = 0;
  totalMinutes = 0;
  topTasks: TaskAnalytics[] = [];
  topTags: TagAnalytics[] = [];

  ngOnInit() {
    this.updateAnalytics();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectAnalytics'] || changes['tagAnalytics']) {
      this.updateAnalytics();
    }
  }

  private updateAnalytics() {
    if (this.projectAnalytics) {
      // Calculate total time
      const totalSeconds = this.projectAnalytics.totalTimeSeconds;
      this.totalHours = Math.floor(totalSeconds / 3600);
      this.totalMinutes = Math.floor((totalSeconds % 3600) / 60);

      // Get top 5 tasks by time spent
      this.topTasks = [...this.projectAnalytics.tasks]
        .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)
        .slice(0, 5);
    }

    // Get top 5 tags by time spent
    this.topTags = [...this.tagAnalytics]
      .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)
      .slice(0, 5);
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  getProgressPercentage(taskSeconds: number): number {
    if (!this.projectAnalytics || this.projectAnalytics.totalTimeSeconds === 0) {
      return 0;
    }
    return (taskSeconds / this.projectAnalytics.totalTimeSeconds) * 100;
  }

  getTagProgressPercentage(tagSeconds: number): number {
    const totalTagTime = this.tagAnalytics.reduce(
      (sum, tag) => sum + tag.totalTimeSeconds,
      0
    );
    if (totalTagTime === 0) return 0;
    return (tagSeconds / totalTagTime) * 100;
  }
}
