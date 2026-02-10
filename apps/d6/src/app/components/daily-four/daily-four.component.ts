import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyFourService, CreateDailyFourDto } from '../../services/daily-four.service';
import { AiAssistanceService } from '../../services/ai-assistance.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-daily-four',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1 class="page-title">Daily Four</h1>
      
      <div class="card">
        <h2>Today's Entry</h2>
        
        <div class="form-group">
          <label class="form-label">Affirmation</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.affirmation"
            placeholder="I am..."
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Mindful Activity</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.mindfulActivity"
            placeholder="What mindful activity did you do today?"
          ></textarea>
          <button class="btn btn-secondary btn-sm" (click)="getAiSuggestion()">
            Get AI Suggestion
          </button>
        </div>

        <div class="form-group">
          <label class="form-label">Gratitude</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.gratitude"
            placeholder="What are you grateful for today?"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Planned Pleasurable Activity</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.plannedPleasurable"
            placeholder="What pleasurable activity do you plan?"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="entry.public">
            Make this entry public
          </label>
        </div>

        <div class="button-group">
          <button class="btn btn-primary" (click)="save()">Save Entry</button>
          <button class="btn btn-secondary" (click)="clear()">Clear</button>
        </div>
      </div>

      @if (aiSuggestion()) {
        <div class="card ai-suggestion">
          <h3>AI Suggestion</h3>
          <p>{{ aiSuggestion() }}</p>
        </div>
      }

      <div class="card">
        <h2>Previous Entries</h2>
        <div class="entries-list">
          @for (entry of previousEntries; track entry.id) {
            <div class="entry-item">
              <div class="entry-date">{{ entry.createdAt | date:'mediumDate' }}</div>
              <div class="entry-preview">{{ entry.affirmation }}</div>
            </div>
          } @empty {
            <p class="empty-state">No previous entries</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .btn-sm {
      padding: 8px 16px;
      font-size: 0.875rem;
      margin-top: 8px;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .ai-suggestion {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .ai-suggestion h3 {
      margin-bottom: 8px;
    }

    .entries-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .entry-item {
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }

    .entry-date {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .entry-preview {
      color: #374151;
    }

    .empty-state {
      color: #9ca3af;
      text-align: center;
      padding: 24px;
    }
  `]
})
export class DailyFourComponent {
  private readonly dailyFourService = inject(DailyFourService);
  private readonly aiService = inject(AiAssistanceService);
  private readonly authState = inject(AuthStateService);

  entry: CreateDailyFourDto = {
    affirmation: '',
    mindfulActivity: '',
    gratitude: '',
    plannedPleasurable: '',
    public: false
  };

  previousEntries: any[] = [];
  aiSuggestion = signal<string>('');

  constructor() {
    this.loadEntries();
  }

  loadEntries() {
    const userId = this.authState.user()?.userId;
    if (userId) {
      this.dailyFourService.getByUserId(userId).subscribe({
        next: (entries) => this.previousEntries = entries,
        error: (err) => console.error('Failed to load entries', err)
      });
    }
  }

  getAiSuggestion() {
    this.aiService.getMindfulActivitySuggestion().subscribe({
      next: (response) => this.aiSuggestion.set(response.suggestion),
      error: (err) => console.error('AI suggestion failed', err)
    });
  }

  save() {
    this.dailyFourService.create(this.entry).subscribe({
      next: () => {
        this.clear();
        this.loadEntries();
      },
      error: (err) => console.error('Failed to save entry', err)
    });
  }

  clear() {
    this.entry = {
      affirmation: '',
      mindfulActivity: '',
      gratitude: '',
      plannedPleasurable: '',
      public: false
    };
    this.aiSuggestion.set('');
  }
}
