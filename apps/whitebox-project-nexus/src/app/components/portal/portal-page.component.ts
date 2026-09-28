import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'nexus-portal-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="portal-container">
      <div class="page-header">
        <p class="eyebrow">Commercial construction operations</p>
        <h1 class="page-title">Project Nexus</h1>
        <p class="page-lead">
          Schedules, drawings, inspection evidence, and change orders for
          commercial builds. Everything stays on company hardware.
        </p>
      </div>

      <div class="project-open-card">
        <label class="input-label" for="projectId">Open a project</label>
        <div class="input-row">
          <input
            id="projectId"
            type="text"
            class="project-input"
            placeholder="Project ID (UUID)"
            [(ngModel)]="projectId"
          />
          <button
            type="button"
            class="btn-open"
            [disabled]="!isProjectId(projectId)"
            (click)="openProject('milestones')"
          >
            Open schedule
          </button>
        </div>
        <p *ngIf="projectError" class="error-banner" role="alert">
          {{ projectError }}
        </p>
      </div>

      <div class="module-grid">
        <div class="module-card">
          <h2 class="module-title">Schedule</h2>
          <p class="module-desc">
            Visual Gantt of construction phases with predecessor dependencies
            and delay alerts.
          </p>
          <button
            type="button"
            class="card-link"
            [disabled]="!isProjectId(projectId)"
            (click)="openProject('milestones')"
          >
            Open schedule
          </button>
        </div>
        <div class="module-card">
          <h2 class="module-title">Drawings</h2>
          <p class="module-desc">
            Blueprint and permit viewer. Sets stream only with a valid
            subcontractor certificate of insurance.
          </p>
          <button
            type="button"
            class="card-link"
            [disabled]="!isProjectId(projectId)"
            (click)="openProject('drawings')"
          >
            Open drawings
          </button>
        </div>
        <div class="module-card">
          <h2 class="module-title">Inspection photos</h2>
          <p class="module-desc">
            Mobile locker hashing every photo with SHA-256 and reading GPS from
            the file itself for court-admissible proof.
          </p>
          <button
            type="button"
            class="card-link"
            [disabled]="!isProjectId(projectId)"
            (click)="openProject('photos')"
          >
            Open photo locker
          </button>
        </div>
        <div class="module-card">
          <h2 class="module-title">Change orders</h2>
          <p class="module-desc">
            Owner and contractor signatures captured on canvas, sealed into
            signed PDF summaries.
          </p>
          <button
            type="button"
            class="card-link"
            [disabled]="!isProjectId(projectId)"
            (click)="openProject('change-orders')"
          >
            Open change orders
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .portal-container {
        max-width: 1100px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2.2rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 10px 0;
      }
      .page-lead {
        color: var(--foreground-muted);
        line-height: 1.6;
        margin: 0 0 28px 0;
        max-width: 640px;
      }
      .project-open-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 28px;
        max-width: 640px;
      }
      .input-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--foreground-muted);
        margin-bottom: 8px;
      }
      .input-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .project-input {
        flex: 1;
        min-width: 220px;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px 14px;
        color: var(--foreground);
        font-size: 0.95rem;
        font-family: monospace;
      }
      .btn-open,
      .card-link {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        font-size: 0.9rem;
      }
      .btn-open:disabled,
      .card-link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error-banner {
        margin-top: 12px;
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
        color: var(--danger);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 0.88rem;
      }
      .module-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      @media (max-width: 700px) {
        .module-grid {
          grid-template-columns: 1fr;
        }
      }
      .module-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 22px;
      }
      .module-title {
        margin: 0 0 8px 0;
        font-size: 1.15rem;
        color: var(--foreground);
      }
      .module-desc {
        color: var(--foreground-muted);
        font-size: 0.9rem;
        line-height: 1.6;
        margin: 0 0 16px 0;
      }
    `,
  ],
})
export class PortalPageComponent {
  projectId = '';
  projectError = '';

  constructor(private readonly router: Router) {}

  isProjectId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      (value || '').trim()
    );
  }

  openProject(section: string): void {
    this.projectError = '';
    if (!this.isProjectId(this.projectId)) {
      this.projectError = 'A valid project ID is required.';
      return;
    }
    void this.router.navigate(['/projects', this.projectId.trim(), section]);
  }
}
