import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="container">
      <h1 class="page-title">Dashboard</h1>
      <div class="dashboard-grid">
        <div class="card">
          <h2>Daily Four</h2>
          <p>Track your daily wellness with the Four pillars</p>
          <button class="btn btn-primary" routerLink="/daily-four">Start Daily Four</button>
        </div>
        <div class="card">
          <h2>Daily Six</h2>
          <p>Extended wellness tracking with mindful awareness</p>
          <button class="btn btn-primary" routerLink="/daily-six">Start Daily Six</button>
        </div>
        <div class="card">
          <h2>Your Progress</h2>
          <p>View your wellness journey over time</p>
          <button class="btn btn-secondary">View Progress</button>
        </div>
        <div class="card">
          <h2>AI Assistant</h2>
          <p>Get personalized wellness suggestions</p>
          <button class="btn btn-secondary">Chat with AI</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 8px;
      color: #1a1a2e;
    }

    .card p {
      color: #6b7280;
      margin-bottom: 16px;
    }
  `]
})
export class DashboardComponent {}
