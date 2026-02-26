import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { StepperComponent } from '../stepper/stepper.component';
import { StepType } from '../stepper/stepper.types';
import {
  DailySixService,
  CreateDailySixDto,
} from '../../services/daily-six.service';
import { AiAssistanceService } from '../../services/ai-assistance.service';
import { MessageService } from '../../services/message.service';
import { AuthStateService } from '../../services/auth-state.service';
import { SpinnerComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-daily-six',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    StepperComponent,
    SpinnerComponent,
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Daily Six</h1>

      <otui-card class="stepper-card">
        <app-stepper
          [questions]="steps()"
          (stepUpdate)="onStepUpdate($event)"
          (completed)="onStepperComplete($event)"
        >
        </app-stepper>
      </otui-card>

      <!-- Completion Modal -->
      @if (showCompletionModal()) {
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>🎉 Congratulations!</h2>
          <p>You have completed the Daily Six module.</p>
          <p class="modal-question">Would you like to make this a public post?</p>
          <div class="modal-actions">
            <otui-button [variant]="'primary'" (action)="submitEntry(true)">
              Yes, make it public
            </otui-button>
            <otui-button [variant]="'secondary'" (action)="submitEntry(false)">
              No, keep it private
            </otui-button>
          </div>
        </div>
      </div>
      }

      <!-- Loading Modal -->
      @if (isLoading()) {
      <div class="modal-overlay">
        <div class="modal-content loading-content">
          <h2>Analyzing your response...</h2>
          <p>
            The AI is reviewing your answer. Once complete, you'll have a
            chance to review and revise if needed.
          </p>
          <otui-spinner [styleType]="'circle'" class="loading-spinner">
          </otui-spinner>
        </div>
      </div>
      }

      <!-- Previous Entries -->
      <otui-card class="entries-card">
        <h2>Previous Entries</h2>
        <div class="entries-list">
          @for (entry of previousEntries(); track entry.id) {
          <div class="entry-item">
            <div class="entry-date">
              {{ entry.createdAt | date : 'mediumDate' }}
            </div>
            <div class="entry-preview">{{ entry.affirmation }}</div>
          </div>
          } @empty {
          <p class="empty-state">No previous entries yet</p>
          }
        </div>
      </otui-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--spacing-lg, 24px);
    }

    .page-title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: var(--spacing-lg, 24px);
      color: var(--foreground, #212121);
    }

    .stepper-card {
      margin-bottom: var(--spacing-lg, 24px);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--spacing-lg, 24px);
    }

    .modal-content {
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 12px);
      padding: var(--spacing-2xl, 48px);
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
    }

    .modal-content h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: var(--spacing-md, 16px);
      color: var(--foreground, #1f2937);
    }

    .modal-content p {
      color: var(--muted, #6b7280);
      margin-bottom: var(--spacing-md, 16px);
    }

    .modal-question {
      font-weight: 600;
      color: var(--foreground, #374151) !important;
    }

    .modal-actions {
      display: flex;
      gap: var(--spacing-md, 16px);
      justify-content: center;
      margin-top: var(--spacing-xl, 32px);
    }

    .loading-content {
      max-width: 400px;
    }

    .loading-spinner {
      margin-top: var(--spacing-lg, 24px);
      --spinner-size: 48px;
    }

    .entries-card {
      h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: var(--spacing-md, 16px);
        color: var(--foreground, #1f2937);
      }
    }

    .entries-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md, 16px);
    }

    .entry-item {
      padding: var(--spacing-md, 16px);
      background: var(--surface-alt, #f9fafb);
      border-radius: var(--border-radius-md, 8px);
      border: 1px solid var(--border, #e5e7eb);
    }

    .entry-date {
      font-size: 0.875rem;
      color: var(--muted, #6b7280);
      margin-bottom: var(--spacing-xs, 4px);
    }

    .entry-preview {
      color: var(--foreground, #374151);
      font-weight: 500;
    }

    .empty-state {
      color: var(--muted, #9ca3af);
      text-align: center;
      padding: var(--spacing-lg, 24px);
    }
  `],
})
export class DailySixComponent {
  private readonly dailySixService = inject(DailySixService);
  private readonly aiService = inject(AiAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  steps = signal<StepType[]>([
    {
      name: 'affirmation',
      label: 'Affirmation',
      question: 'Provide a small affirmation for yourself.',
      description:
        'This can be anything positive about yourself, or something you find inspirational.',
      canContinue: false,
    },
    {
      name: 'judgement',
      label: 'Judgement',
      question: 'What is something you are judging yourself for today?',
      description:
        'This can be anything that you feel is holding you back or causing you stress. It can be a small or large judgement, but it should be something that you are aware of.',
      canContinue: false,
    },
    {
      name: 'nonJudgement',
      label: 'Non-Judgement',
      question: 'What is something you can let go of today?',
      description:
        'This can be anything that you feel is holding you back, but it is important to practice framing it in a non-judgemental way. Instead of assigning positive or negative value, try to see things for what they are.',
      canContinue: false,
    },
    {
      name: 'plannedPleasurable',
      label: 'Planned Pleasurable',
      question: 'What is something pleasurable you plan to do today?',
      description:
        'This can be a small activity that brings you joy, like reading a book or going for a walk.',
      canContinue: false,
    },
    {
      name: 'mindfulActivity',
      label: 'Mindful Activity',
      question: 'What is something you plan to do today that is mindful?',
      description:
        'This can be anything that helps you stay present and engaged, like meditation or deep breathing. It can be a mundane task or chore that you plan to do with all your presence.',
      canContinue: false,
    },
    {
      name: 'gratitude',
      label: 'Gratitude',
      question: 'What is something you are grateful for today?',
      description:
        'This can be anything that brings you joy or happiness, like a friend, family member, or pet.',
      canContinue: false,
    },
  ]);

  isLoading = signal(false);
  showCompletionModal = signal(false);
  previousEntries = signal<any[]>([]);
  private answers: string[] = [];

  constructor() {
    this.loadEntries();
  }

  onStepUpdate(step: StepType): void {
    this.isLoading.set(true);
    const currentStepIndex = this.steps().findIndex(
      (s) => s.name === step.name
    );

    if (currentStepIndex !== -1 && step.answer) {
      this.analyzeStepResponse(step, currentStepIndex);
    }
  }

  private analyzeStepResponse(step: StepType, index: number): void {
    const analysisMap: { [key: string]: () => void } = {
      affirmation: () => {
        this.aiService.getAffirmation().subscribe({
          next: (response) => {
            this.updateStepResponse(index, response.suggestion, true);
          },
          error: (err) => this.handleAnalysisError(index, err),
        });
      },
      judgement: () => {
        this.aiService.reflectJudgment(step.answer || '').subscribe({
          next: (response) => {
            this.updateStepResponse(index, response.reflection, true);
          },
          error: (err) => this.handleAnalysisError(index, err),
        });
      },
      nonJudgement: () => {
        // Provide supportive feedback for non-judgement practice
        this.updateStepResponse(
          index,
          'Practicing non-judgement is a powerful skill. You\'re learning to observe without assigning value - this is great progress!',
          true
        );
      },
      mindfulActivity: () => {
        this.aiService.getMindfulActivitySuggestion().subscribe({
          next: (response) => {
            this.updateStepResponse(
              index,
              `Suggestion: ${response.suggestion}`,
              true
            );
          },
          error: (err) => this.handleAnalysisError(index, err),
        });
      },
      gratitude: () => {
        this.aiService.analyzeGratitudeEntry(step.answer || '').subscribe({
          next: (response) => {
            this.updateStepResponse(index, response.analysis, true);
          },
          error: (err) => this.handleAnalysisError(index, err),
        });
      },
      plannedPleasurable: () => {
        this.updateStepResponse(
          index,
          'This looks like a great plan! Remember to be fully present when you do this activity.',
          true
        );
      },
    };

    const analyze = analysisMap[step.name];
    if (analyze) {
      analyze();
    } else {
      this.isLoading.set(false);
    }
  }

  private updateStepResponse(
    index: number,
    response: string,
    canContinue: boolean
  ): void {
    const updatedSteps = [...this.steps()];
    updatedSteps[index] = {
      ...updatedSteps[index],
      response,
      canContinue,
    };
    this.steps.set(updatedSteps);
    this.isLoading.set(false);
  }

  private handleAnalysisError(index: number, error: any): void {
    console.error('AI analysis error:', error);
    const updatedSteps = [...this.steps()];
    updatedSteps[index] = {
      ...updatedSteps[index],
      response:
        'Unable to analyze response. You can continue with your entry.',
      canContinue: true,
    };
    this.steps.set(updatedSteps);
    this.isLoading.set(false);
    this.messageService.error('AI analysis failed. You can still continue.');
  }

  onStepperComplete(answers: string[]): void {
    this.answers = answers;
    this.showCompletionModal.set(true);
  }

  submitEntry(isPublic: boolean): void {
    const [
      affirmation,
      judgement,
      nonJudgement,
      plannedPleasurable,
      mindfulActivity,
      gratitude,
    ] = this.answers;

    const dto: CreateDailySixDto = {
      affirmation,
      judgement,
      nonJudgement,
      plannedPleasurable,
      mindfulActivity,
      gratitude,
      public: isPublic,
    };

    this.dailySixService.create(dto).subscribe({
      next: () => {
        this.messageService.success('Daily Six entry saved successfully!');
        this.showCompletionModal.set(false);
        this.resetForm();
        this.loadEntries();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('Error saving entry:', err);
        this.messageService.error('Failed to save entry. Please try again.');
        this.showCompletionModal.set(false);
      },
    });
  }

  private loadEntries(): void {
    const userId = this.authState.user()?.userId;
    if (userId) {
      this.dailySixService.getByUserId(userId).subscribe({
        next: (entries) => {
          this.previousEntries.set(entries);
        },
        error: (err) => {
          console.error('Failed to load entries:', err);
        },
      });
    }
  }

  private resetForm(): void {
    this.answers = [];
    this.steps.set(
      this.steps().map((step) => ({
        ...step,
        response: undefined,
        canContinue: false,
        answer: undefined,
      }))
    );
  }
}
