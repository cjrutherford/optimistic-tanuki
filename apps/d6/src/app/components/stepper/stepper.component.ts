import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StepType } from './stepper.types';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="stepper-container">
      <div class="stepper-header">
        <ng-container *ngFor="let q of questions; let i = index">
          <span [class.active]="i === currentStep">{{ q.label || 'Step ' + (i + 1) }}</span>
          <span *ngIf="i < questions.length - 1">→</span>
        </ng-container>
      </div>

      <div class="stepper-content" *ngIf="questions.length > 0">
        <div class="question">
          <ng-container *ngIf="questions[currentStep] as question">
            <label [for]="'question-' + currentStep">{{ question.question }}</label>
            <p class="description">{{ question.description }}</p>
            <textarea
              [id]="'question-' + currentStep"
              [(ngModel)]="answers[currentStep]"
              rows="4"
              placeholder="Enter your response here..."
            ></textarea>
          </ng-container>
        </div>
        <div class="analysis" *ngIf="indexHasResponse()">
          <h3>Analysis</h3>
          <div class="analysis-content">
            <p>{{ questions[currentStep].response }}</p>
          </div>
        </div>
      </div>

      <div class="stepper-actions">
        <otui-button
          [variant]="'secondary'"
          (action)="prevStep()"
          [disabled]="currentStep === 0"
        >
          Previous
        </otui-button>
        <otui-button
          [variant]="'secondary'"
          (action)="processStepAction()"
        >
          Analyze
        </otui-button>
        <otui-button
          [variant]="'primary'"
          (action)="nextStep()"
        >
          {{ currentStep === questions.length - 1 ? 'Finish' : 'Next' }}
        </otui-button>
      </div>
    </div>
  `,
  styles: [`
    .stepper-container {
      border: 1px solid var(--border, #e5e7eb);
      border-radius: var(--border-radius-lg, 12px);
      padding: var(--spacing-lg, 24px);
      background: var(--surface, #ffffff);
    }

    .stepper-header {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      padding: var(--spacing-md, 16px);
      gap: var(--spacing-sm, 8px);
      margin-bottom: var(--spacing-lg, 24px);
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border, #e5e7eb);
    }

    .stepper-header span {
      color: var(--muted, #6b7280);
      font-size: 0.875rem;
      padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
      border-radius: var(--border-radius-sm, 4px);
    }

    .stepper-header span.active {
      font-weight: 600;
      color: var(--primary, #4f46e5);
      background: var(--primary-light, #eef2ff);
    }

    .stepper-content {
      margin-bottom: var(--spacing-lg, 24px);
    }

    .question {
      margin-bottom: var(--spacing-lg, 24px);
    }

    label {
      display: block;
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: var(--spacing-sm, 8px);
      color: var(--foreground, #1f2937);
    }

    .description {
      color: var(--muted, #6b7280);
      margin-bottom: var(--spacing-md, 16px);
      line-height: 1.5;
    }

    textarea {
      width: 100%;
      padding: var(--spacing-md, 16px);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: var(--border-radius-md, 8px);
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      background: var(--background, #ffffff);
      color: var(--foreground, #1f2937);
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--primary, #4f46e5);
      box-shadow: 0 0 0 3px var(--primary-light, #eef2ff);
    }

    .analysis {
      background: var(--surface-alt, #f9fafb);
      border-radius: var(--border-radius-md, 8px);
      padding: var(--spacing-md, 16px);
      margin-top: var(--spacing-md, 16px);
    }

    .analysis h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--primary, #4f46e5);
      margin-bottom: var(--spacing-sm, 8px);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .analysis-content p {
      color: var(--foreground, #374151);
      line-height: 1.6;
      margin: 0;
    }

    .stepper-actions {
      display: flex;
      justify-content: space-between;
      gap: var(--spacing-md, 16px);
    }

    @media (max-width: 600px) {
      .stepper-actions {
        flex-direction: column;
      }
    }
  `],
})
export class StepperComponent {
  @Input() questions: StepType[] = [];
  @Output() stepUpdate = new EventEmitter<StepType>();
  @Output() stepChange = new EventEmitter<number>();
  @Output() completed = new EventEmitter<string[]>();

  currentStep = 0;
  answers: string[] = [];

  nextStep(): void {
    if (!this.questions[this.currentStep]?.canContinue) {
      this.questions[this.currentStep].response = 'There appears to be something wrong with your response.';
      return;
    }
    if (this.currentStep < this.questions.length - 1) {
      this.currentStep++;
      this.stepChange.emit(this.currentStep);
    } else {
      this.completed.emit(this.answers);
    }
  }

  indexHasResponse(): boolean {
    return this.questions[this.currentStep]?.response !== undefined;
  }

  processStepAction(): void {
    const currentStep = this.questions[this.currentStep];
    currentStep.answer = this.answers[this.currentStep];
    this.stepUpdate.emit(currentStep);
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.stepChange.emit(this.currentStep);
    }
  }
}
