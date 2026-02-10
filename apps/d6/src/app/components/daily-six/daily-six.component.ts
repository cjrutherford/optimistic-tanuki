import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailySixService, CreateDailySixDto } from '../../services/daily-six.service';
import { AiAssistanceService } from '../../services/ai-assistance.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-daily-six',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h1 class="page-title">Daily Six</h1>
      
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
          <label class="form-label">Judgement</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.judgement"
            placeholder="How did you judge experiences today?"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Non-Judgement</label>
          <textarea 
            class="form-input" 
            rows="3"
            [(ngModel)]="entry.nonJudgement"
            placeholder="How can you observe without judging?"
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

      @if (aiEncouragement()) {
        <div class="card ai-encouragement">
          <h3>AI Reflection</h3>
          <p>{{ aiEncouragement() }}</p>
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

    .ai-encouragement {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
    }

    .ai-encouragement h3 {
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
export class DailySixComponent {
  private readonly dailySixService = inject(DailySixService);
  private readonly aiService = inject(AiAssistanceService);
  private readonly authState = inject(AuthStateService);

  entry: CreateDailySixDto = {
    affirmation: '',
    judgement: '',
    nonJudgement: '',
    mindfulActivity: '',
    gratitude: '',
    public: false
  };

  previousEntries: any[] = [];
  aiEncouragement = signal<string>('');

  constructor() {
    this.loadEntries();
  }

  loadEntries() {
    const userId = this.authState.user()?.userId;
    if (userId) {
      this.dailySixService.getByUserId(userId).subscribe({
        next: (entries) => this.previousEntries = entries,
        error: (err) => console.error('Failed to load entries', err)
      });
    }
  }

  analyzeEntry() {
    if (this.entry.gratitude) {
      this.aiService.analyzeGratitudeEntry(this.entry.gratitude).subscribe({
        next: (response) => this.aiEncouragement.set(response.analysis),
        error: (err) => console.error('AI analysis failed', err)
      });
    }
  }

  save() {
    this.dailySixService.create(this.entry).subscribe({
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
      judgement: '',
      nonJudgement: '',
      mindfulActivity: '',
      gratitude: '',
      public: false
    };
    this.aiEncouragement.set('');
  }
}
