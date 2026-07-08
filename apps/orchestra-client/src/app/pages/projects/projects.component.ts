import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AudioWorkstationService,
  AudioProject,
} from '../../services/audio-workstation.service';

@Component({
  selector: 'orch-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="projects-page">
      <header class="page-header">
        <h1>Orchestra</h1>
        <p class="subtitle">AI-Native Music Production Studio</p>
        <button
          class="btn-primary"
          (click)="showCreateForm = true"
          *ngIf="!showCreateForm"
        >
          + New Project
        </button>
      </header>

      <div class="create-form" *ngIf="showCreateForm">
        <h3>Create New Project</h3>
        <input
          [(ngModel)]="newProject.name"
          placeholder="Project name"
          class="input-field"
        />
        <div class="form-row">
          <select [(ngModel)]="newProject.genre" class="input-field">
            <option value="">Select genre...</option>
            <option>Pop</option>
            <option>Rock</option>
            <option>Electronic</option>
            <option>Hip Hop</option>
            <option>Jazz</option>
            <option>Classical</option>
            <option>Ambient</option>
            <option>Lo-fi</option>
          </select>
          <input
            [(ngModel)]="newProject.bpm"
            type="number"
            placeholder="BPM (120)"
            class="input-field small"
          />
          <input
            [(ngModel)]="newProject.key"
            placeholder="Key (C)"
            class="input-field small"
          />
        </div>
        <div class="form-actions">
          <button
            class="btn-primary"
            (click)="createProject()"
            [disabled]="!newProject.name"
          >
            Create
          </button>
          <button class="btn-secondary" (click)="showCreateForm = false">
            Cancel
          </button>
        </div>
      </div>

      <div class="project-grid" *ngIf="projects.length > 0; else emptyState">
        <div
          class="project-card"
          *ngFor="let project of projects"
          (click)="openProject(project.id)"
        >
          <div class="card-header">
            <h3>{{ project.name }}</h3>
            <span class="genre-badge" *ngIf="project.genre">{{
              project.genre
            }}</span>
          </div>
          <div class="card-meta">
            <span *ngIf="project.bpm">{{ project.bpm }} BPM</span>
            <span *ngIf="project.key">{{ project.key }}</span>
            <span>Updated: {{ project.updatedAt | date : 'short' }}</span>
          </div>
          <div class="card-footer">
            <span class="track-count"
              >{{ (project.tracks && project.tracks.length) || 0 }} tracks</span
            >
          </div>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <div class="empty-icon">🎵</div>
          <h2>Start your first track</h2>
          <p>
            Describe the music you want to create, and Orchestra's AI agents
            will handle composition, mixing, and mastering.
          </p>
          <button class="btn-primary" (click)="showCreateForm = true">
            + New Project
          </button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .projects-page {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
      }
      .page-header {
        margin-bottom: 2rem;
      }
      .page-header h1 {
        font-size: 2rem;
        margin: 0;
        color: #fff;
      }
      .subtitle {
        color: #888;
        margin-top: 0.25rem;
      }
      .create-form {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
      }
      .create-form h3 {
        margin: 0 0 1rem;
        color: #fff;
      }
      .form-row {
        display: flex;
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      .input-field {
        background: #222;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 0.75rem;
        color: #e0e0e0;
        width: 100%;
        font-size: 0.9rem;
      }
      .input-field.small {
        max-width: 120px;
      }
      .input-field::placeholder {
        color: #666;
      }
      .form-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
      }
      .project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }
      .project-card {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 1.25rem;
        cursor: pointer;
        transition: border-color 0.2s;
      }
      .project-card:hover {
        border-color: #666;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .card-header h3 {
        margin: 0;
        color: #fff;
        font-size: 1.1rem;
      }
      .genre-badge {
        background: #333;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        color: #aaa;
      }
      .card-meta {
        margin-top: 0.75rem;
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: #888;
      }
      .card-footer {
        margin-top: 0.75rem;
        font-size: 0.8rem;
        color: #666;
      }
      .btn-primary {
        background: #6c5ce7;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-secondary {
        background: #333;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
      }
      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: #888;
      }
      .empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      .empty-state h2 {
        color: #fff;
      }
    `,
  ],
})
export class ProjectsComponent implements OnInit {
  private readonly service = inject(AudioWorkstationService);
  private readonly router = inject(Router);

  projects: AudioProject[] = [];
  showCreateForm = false;
  newProject = { name: '', genre: '', bpm: 120, key: 'C' };

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.service.getProjects().subscribe({
      next: (projects) => (this.projects = projects),
      error: (err) => console.error('Failed to load projects', err),
    });
  }

  createProject() {
    this.service
      .createProject({
        name: this.newProject.name,
        bpm: this.newProject.bpm,
        key: this.newProject.key,
        genre: this.newProject.genre || undefined,
      })
      .subscribe({
        next: (project) => {
          this.showCreateForm = false;
          this.newProject = { name: '', genre: '', bpm: 120, key: 'C' };
          this.openProject(project.id);
        },
        error: (err) => console.error('Failed to create project', err),
      });
  }

  openProject(id: string) {
    this.router.navigate(['/workspace', id]);
  }
}
