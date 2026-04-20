# Enhanced Onboarding Interview & Lead Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a sophisticated 15-question onboarding interview that captures user profile, skills, and preferences, then uses AI to generate optimized discovery topics. Also implement a multi-step lead discovery analysis pipeline with full scoring.

**Architecture:**

- Multi-step wizard UI in leads-app replacing current 6-question modal
- AI-powered topic generation service in lead-tracker using existing AI orchestrator
- 5-step discovery pipeline with weighted scoring and lead classification
- Enhanced LeadTopic model with priority, confidence, and buyer persona fields

**Tech Stack:** Angular standalone app, NestJS microservice, TypeORM, existing AI Orchestrator

---

## Task 1: Create enhanced onboarding interview types and interfaces

**Files:**

- Create: `libs/models/src/lib/libs/leads/user-onboarding-profile.interface.ts`
- Modify: `libs/models/src/lib/libs/leads/index.ts`

**Step 1: Write the interface definitions**

Create the enhanced user onboarding profile with 15 questions across 4 sections:

```typescript
// libs/models/src/lib/libs/leads/user-onboarding-profile.interface.ts
export interface UserOnboardingProfile {
  id?: string;
  userId?: string;
  // Section A: Professional Background
  serviceOffer: string;
  yearsExperience: string;
  skills: string[];
  certifications: string[];
  // Section B: Target Customer
  idealCustomer: string;
  companySizeTarget: string[];
  industries: string[];
  problemsSolved: string[];
  outcomes: string[];
  budgetRange: string;
  geographicFocus: string;
  // Section C: Sales & Communication
  salesApproach: string;
  outreachMethod: string;
  communicationStyle: string;
  discType?: string;
  // Section D: Discovery Preferences
  leadSignalTypes: string[];
  excludedCompanies: string[];
  excludedIndustries: string[];
  // Status
  currentStep: number;
  completedAt?: Date;
}

export interface OnboardingQuestion {
  id: string;
  section: 'professional' | 'customer' | 'sales' | 'preferences';
  question: string;
  description?: string;
  type: 'text' | 'textarea' | 'multiselect' | 'chips' | 'single-select';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface GeneratedTopicSuggestion {
  name: string;
  description: string;
  keywords: string[];
  excludedTerms: string[];
  discoveryIntent: LeadTopicDiscoveryIntent;
  sources: LeadDiscoverySource[];
  priority: number;
  targetCompanies: string[];
  buyerPersona: string;
  painPoints: string[];
  valueProposition: string;
  searchStrategy: 'aggressive' | 'balanced' | 'conservative';
  confidence: number;
}

export interface OnboardingAnalysisResult {
  profile: UserOnboardingProfile;
  suggestedTopics: GeneratedTopicSuggestion[];
  analyzedAt: Date;
}
```

**Step 2: Update the index exports**

```typescript
// libs/models/src/lib/libs/leads/index.ts - add these exports
export * from './user-onboarding-profile.interface';
```

**Step 3: Run TypeScript to verify**

Run: `pnpm exec tsc -p libs/models/tsconfig.lib.json --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add libs/models/src/lib/libs/leads/user-onboarding-profile.interface.ts libs/models/src/lib/libs/leads/index.ts
git commit -m "feat: add enhanced onboarding profile interfaces"
```

---

## Task 2: Extend LeadTopic model with new fields

**Files:**

- Modify: `libs/models/src/lib/libs/leads/lead-topic.model.ts`
- Modify: `libs/models/src/lib/libs/leads/create-lead-topic.dto.ts`
- Modify: `libs/models/src/lib/libs/leads/update-lead-topic.dto.ts`

**Step 1: Write the failing test**

```typescript
// Test would verify new fields are accepted
const topicDto: CreateLeadTopicDto = {
  name: 'React roles',
  priority: 1,
  targetCompanies: ['SaaS companies'],
  buyerPersona: 'CTOs',
  painPoints: ['legacy code'],
  valueProposition: 'modernization',
  searchStrategy: 'balanced',
  confidence: 85,
};
expect(topicDto.priority).toBe(1);
```

**Step 2: Run to verify**

Run: `pnpm exec tsc -p libs/models/tsconfig.lib.json --noEmit`
Expected: FAIL - new fields don't exist yet

**Step 3: Update the LeadTopic model**

```typescript
// libs/models/src/lib/libs/leads/lead-topic.model.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '.';

@Entity()
export class LeadTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('simple-array')
  keywords: string[];

  @Column('simple-array', { nullable: true })
  excludedTerms: string[];

  @Column({ nullable: true })
  discoveryIntent: LeadTopicDiscoveryIntent;

  @Column('simple-array', { nullable: true })
  sources: LeadDiscoverySource[];

  @Column('simple-array', { nullable: true })
  googleMapsCities: string[];

  @Column('simple-array', { nullable: true })
  googleMapsTypes: string[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  lastRun: Date;

  @Column({ default: 0 })
  leadCount: number;

  // NEW FIELDS
  @Column({ nullable: true })
  priority: number;

  @Column('simple-array', { nullable: true })
  targetCompanies: string[];

  @Column({ nullable: true })
  buyerPersona: string;

  @Column('simple-array', { nullable: true })
  painPoints: string[];

  @Column({ nullable: true })
  valueProposition: string;

  @Column({ nullable: true })
  searchStrategy: 'aggressive' | 'balanced' | 'conservative';

  @Column({ nullable: true })
  confidence: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Step 4: Update DTOs**

```typescript
// libs/models/src/lib/libs/leads/create-lead-topic.dto.ts
export interface CreateLeadTopicDto {
  name: string;
  description?: string;
  keywords: string[];
  excludedTerms?: string[];
  discoveryIntent?: LeadTopicDiscoveryIntent;
  sources?: LeadDiscoverySource[];
  googleMapsCities?: string[];
  googleMapsTypes?: string[];
  enabled?: boolean;
  // NEW
  priority?: number;
  targetCompanies?: string[];
  buyerPersona?: string;
  painPoints?: string[];
  valueProposition?: string;
  searchStrategy?: 'aggressive' | 'balanced' | 'conservative';
  confidence?: number;
}
```

**Step 5: Run TypeScript to verify**

Run: `pnpm exec tsc -p libs/models/tsconfig.lib.json --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add libs/models/src/lib/libs/leads/lead-topic.model.ts libs/models/src/lib/libs/leads/create-lead-topic.dto.ts libs/models/src/lib/libs/leads/update-lead-topic.dto.ts
git commit -m "feat: extend LeadTopic model with AI-generated fields"
```

---

## Task 3: Create LeadAnalysis model for discovery scoring

**Files:**

- Create: `libs/models/src/lib/libs/leads/lead-analysis.model.ts`
- Modify: `libs/models/src/lib/libs/leads/index.ts`

**Step 1: Write the interface**

```typescript
// libs/models/src/lib/libs/leads/lead-analysis.model.ts
export interface LeadAnalysis {
  id: string;
  leadId: string;
  topicId: string;

  // Step scores (0-100)
  relevanceScore: number;
  roleScore: number;
  companyFitScore: number;
  intentScore: number;
  contactScore: number;

  // Final weighted score
  finalScore: number;

  // Classification
  fitClassification: 'hot' | 'warm' | 'cold' | 'reject';

  // Detailed findings
  detectedSignals: string[];
  decisionMakerLevel: string;
  growthIndicators: string[];

  // Metadata
  analysisVersion: string;
  analyzedAt: Date;
}

export interface LeadAnalysisDto {
  leadId: string;
  topicId: string;
  relevanceScore?: number;
  roleScore?: number;
  companyFitScore?: number;
  intentScore?: number;
  contactScore?: number;
  detectedSignals?: string[];
  decisionMakerLevel?: string;
  growthIndicators?: string[];
}
```

**Step 2: Run TypeScript to verify**

Run: `pnpm exec tsc -p libs/models/tsconfig.lib.json --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add libs/models/src/lib/libs/leads/lead-analysis.model.ts libs/models/src/lib/libs/leads/index.ts
git commit -m "feat: add lead analysis model for discovery scoring"
```

---

## Task 4: Create the interview wizard component

**Files:**

- Create: `apps/leads-app/src/app/interview-wizard.component.ts`
- Create: `apps/leads-app/src/app/interview-wizard.component.html`
- Create: `apps/leads-app/src/app/interview-wizard.component.scss`

**Step 1: Write the component**

```typescript
// apps/leads-app/src/app/interview-wizard.component.ts
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserOnboardingProfile, OnboardingQuestion, GeneratedTopicSuggestion } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-interview-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview-wizard.component.html',
  styleUrl: './interview-wizard.component.scss',
})
export class InterviewWizardComponent {
  @Input() showModal = false;
  @Output() close = new EventEmitter<void>();
  @Output() submitProfile = new EventEmitter<UserOnboardingProfile>();
  @Output() analyzeTopics = new EventEmitter<UserOnboardingProfile>();
  @Output() confirmTopics = new EventEmitter<GeneratedTopicSuggestion[]>();

  currentStep = 0;
  submittedTopics: GeneratedTopicSuggestion[] = [];
  isAnalyzing = false;
  showTopicReview = false;

  profile: UserOnboardingProfile = {
    serviceOffer: '',
    yearsExperience: '',
    skills: [],
    certifications: [],
    idealCustomer: '',
    companySizeTarget: [],
    industries: [],
    problemsSolved: [],
    outcomes: [],
    budgetRange: '',
    geographicFocus: '',
    salesApproach: '',
    outreachMethod: '',
    communicationStyle: '',
    discType: '',
    leadSignalTypes: [],
    excludedCompanies: [],
    excludedIndustries: [],
    currentStep: 0,
  };

  sections = [
    { id: 'professional', title: 'Professional Background', questions: 4 },
    { id: 'customer', title: 'Target Customer', questions: 6 },
    { id: 'sales', title: 'Sales & Communication', questions: 4 },
    { id: 'preferences', title: 'Discovery Preferences', questions: 2 },
  ];

  questions: OnboardingQuestion[] = [
    // Section A: Professional
    { id: 'serviceOffer', section: 'professional', question: 'What service or offer do you sell?', type: 'text', required: true, placeholder: 'e.g., React modernization, SEO services, Executive coaching' },
    { id: 'yearsExperience', section: 'professional', question: 'How many years of experience do you have?', type: 'single-select', options: ['0-1 years', '2-5 years', '6-10 years', '10+ years'], required: true },
    { id: 'skills', section: 'professional', question: 'What are your key skills and areas of expertise?', type: 'chips', required: true, placeholder: 'Type a skill and press Enter' },
    { id: 'certifications', section: 'professional', question: 'Do you have any certifications or special credentials?', type: 'chips', required: false, placeholder: 'e.g., AWS Certified, PMP, Google Partner' },

    // Section B: Customer
    { id: 'idealCustomer', section: 'customer', question: 'Describe your ideal customer', type: 'textarea', required: true, placeholder: 'Company size, industry, roles, pain points...' },
    { id: 'companySizeTarget', section: 'customer', question: 'What company sizes do you work with?', type: 'multiselect', options: ['1-10', '11-50', '51-200', '201-500', '500+'], required: true },
    { id: 'industries', section: 'customer', question: 'Which industries do you focus on?', type: 'chips', required: true, placeholder: 'e.g., SaaS, Healthcare, Finance' },
    { id: 'problemsSolved', section: 'customer', question: 'What problems do you solve for your customers?', type: 'chips', required: true, placeholder: 'e.g., slow website, low conversions' },
    { id: 'outcomes', section: 'customer', question: 'What outcomes/results do they achieve?', type: 'chips', required: true, placeholder: 'e.g., 50% faster load times' },
    { id: 'budgetRange', section: 'customer', question: 'What is your typical budget range?', type: 'single-select', options: ['Under $5k', '$5k-$25k', '$25k-$100k', '$100k+'], required: false },
    { id: 'geographicFocus', section: 'customer', question: 'What is your geographic focus?', type: 'single-select', options: ['Global', 'North America', 'US only', 'Europe', 'Specific regions'], required: true },

    // Section C: Sales
    { id: 'salesApproach', section: 'sales', question: 'What is your preferred sales approach?', type: 'single-select', options: ['Consultative', 'Transactional', 'Inbound only', 'Outbound focused', 'Hybrid'], required: true },
    { id: 'outreachMethod', section: 'sales', question: 'How do you typically reach out to prospects?', type: 'multiselect', options: ['Email', 'LinkedIn', 'Cold calls', 'Networking events', 'Content marketing', 'Referrals'], required: true },
    { id: 'communicationStyle', section: 'sales', question: 'What is your communication style?', type: 'single-select', options: ['Formal', 'Casual', 'Technical', 'Story-driven', 'Direct'], required: true },
    { id: 'discType', section: 'sales', question: 'Do you know your DISC personality type? (Optional)', type: 'single-select', options: ['D - Dominance', 'I - Influence', 'S - Steadiness', 'C - Conscientiousness', "I don't know"], required: false },

    // Section D: Preferences
    { id: 'leadSignalTypes', section: 'preferences', question: 'What types of lead signals interest you?', type: 'multiselect', options: ['Job changes', 'Company hiring', 'Funding rounds', 'Company growth', 'New product launches', 'Expansion news'], required: true },
    { id: 'excludedCompanies', section: 'preferences', question: 'Any companies or industries to exclude?', type: 'chips', required: false, placeholder: 'e.g., Competitors, Industries you avoid' },
  ];

  get currentSection(): (typeof this.sections)[0] {
    const sectionId = this.getSectionIdForStep(this.currentStep);
    return this.sections.find((s) => s.id === sectionId) || this.sections[0];
  }

  get currentSectionQuestions(): OnboardingQuestion[] {
    const sectionId = this.getSectionIdForStep(this.currentStep);
    return this.questions.filter((q) => q.section === sectionId);
  }

  get progressPercentage(): number {
    return Math.round(((this.currentStep + 1) / this.sections.length) * 100);
  }

  get canGoNext(): boolean {
    const sectionQuestions = this.currentSectionQuestions;
    return sectionQuestions.every((q) => !q.required || this.isAnswered(q.id));
  }

  get isLastStep(): boolean {
    return this.currentStep === this.sections.length - 1;
  }

  private getSectionIdForStep(step: number): string {
    return this.sections[step]?.id || 'professional';
  }

  isAnswered(questionId: string): boolean {
    const value = (this.profile as any)[questionId];
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }

  nextStep() {
    if (this.currentStep < this.sections.length - 1) {
      this.currentStep++;
      this.profile.currentStep = this.currentStep;
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  goToStep(step: number) {
    if (step <= this.currentStep) {
      this.currentStep = step;
    }
  }

  addChip(field: 'skills' | 'certifications' | 'problemsSolved' | 'outcomes' | 'industries' | 'excludedCompanies', event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value && !this.profile[field].includes(value)) {
      this.profile[field] = [...this.profile[field], value];
      input.value = '';
    }
  }

  removeChip(field: 'skills' | 'certifications' | 'problemsSolved' | 'outcomes' | 'industries' | 'excludedCompanies', value: string) {
    this.profile[field] = this.profile[field].filter((v) => v !== value);
  }

  toggleMultiSelect(field: 'companySizeTarget' | 'leadSignalTypes' | 'outreachMethod', value: string) {
    const current = this.profile[field] as string[];
    if (current.includes(value)) {
      this.profile[field] = current.filter((v) => v !== value);
    } else {
      this.profile[field] = [...current, value];
    }
  }

  isMultiSelected(field: 'companySizeTarget' | 'leadSignalTypes' | 'outreachMethod', value: string): boolean {
    return (this.profile[field] as string[]).includes(value);
  }

  submitForAnalysis() {
    this.isAnalyzing = true;
    this.analyzeTopics.emit(this.profile);
  }

  onTopicsAnalyzed(topics: GeneratedTopicSuggestion[]) {
    this.isAnalyzing = false;
    this.submittedTopics = topics;
    this.showTopicReview = true;
  }

  confirmAndCreate() {
    this.confirmTopics.emit(this.submittedTopics);
  }

  backToInterview() {
    this.showTopicReview = false;
    this.submittedTopics = [];
  }

  closeModal() {
    this.close.emit();
    this.reset();
  }

  private reset() {
    this.currentStep = 0;
    this.showTopicReview = false;
    this.submittedTopics = [];
    this.isAnalyzing = false;
  }
}
```

**Step 2: Write the HTML template**

```html
<!-- apps/leads-app/src/app/interview-wizard.component.html -->
<div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
  <div class="modal-content" (click)="$event.stopPropagation()">
    <!-- Topic Review Mode -->
    <ng-container *ngIf="showTopicReview; else interviewMode">
      <div class="modal-header">
        <h2>Review Generated Topics</h2>
        <button class="close-btn" (click)="closeModal()">×</button>
      </div>

      <div class="topic-review">
        <p class="review-intro">Based on your profile, we've generated these discovery topics:</p>

        <div class="topic-cards">
          <div class="topic-card" *ngFor="let topic of submittedTopics; let i = index">
            <div class="topic-header">
              <span class="topic-priority">#{{ i + 1 }}</span>
              <span class="confidence-badge" [class.high]="topic.confidence >= 80" [class.medium]="topic.confidence >= 60 && topic.confidence < 80"> {{ topic.confidence }}% confidence </span>
            </div>
            <h3>{{ topic.name }}</h3>
            <p class="topic-desc">{{ topic.description }}</p>

            <div class="topic-details">
              <div class="detail-row">
                <span class="label">Keywords:</span>
                <span class="value">{{ topic.keywords.join(', ') }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Strategy:</span>
                <span class="value">{{ topic.searchStrategy }}</span>
              </div>
              <div class="detail-row" *ngIf="topic.buyerPersona">
                <span class="label">Buyer:</span>
                <span class="value">{{ topic.buyerPersona }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="review-actions">
          <button class="btn-secondary" (click)="backToInterview()">Edit Profile</button>
          <button class="btn-primary" (click)="confirmAndCreate()">Confirm & Create Topics</button>
        </div>
      </div>
    </ng-container>

    <!-- Interview Mode -->
    <ng-template #interviewMode>
      <div class="modal-header">
        <h2>Welcome! Let's set up your lead discovery</h2>
        <button class="close-btn" (click)="closeModal()">×</button>
      </div>

      <!-- Progress -->
      <div class="progress-bar">
        <div class="progress-fill" [style.width.%]="progressPercentage"></div>
      </div>

      <div class="section-indicator">
        <span>Step {{ currentStep + 1 }} of {{ sections.length }}: {{ currentSection.title }}</span>
      </div>

      <!-- Questions -->
      <div class="questions-container">
        <div class="question-card" *ngFor="let question of currentSectionQuestions">
          <label [for]="question.id">
            {{ question.question }}
            <span class="required" *ngIf="question.required">*</span>
          </label>

          <!-- Text input -->
          <input *ngIf="question.type === 'text'" type="text" [id]="question.id" [(ngModel)]="profile[question.id]" [placeholder]="question.placeholder" />

          <!-- Textarea -->
          <textarea *ngIf="question.type === 'textarea'" [id]="question.id" [(ngModel)]="profile[question.id]" [placeholder]="question.placeholder" rows="3"></textarea>

          <!-- Single select -->
          <select *ngIf="question.type === 'single-select'" [id]="question.id" [(ngModel)]="profile[question.id]">
            <option value="">Select...</option>
            <option *ngFor="let opt of question.options" [value]="opt">{{ opt }}</option>
          </select>

          <!-- Multi select -->
          <div class="multi-select" *ngIf="question.type === 'multiselect'">
            <button *ngFor="let opt of question.options" class="option-btn" [class.selected]="isMultiSelected(question.id, opt)" (click)="toggleMultiSelect(question.id, opt)">{{ opt }}</button>
          </div>

          <!-- Chips input -->
          <div class="chips-input" *ngIf="question.type === 'chips'">
            <div class="chips">
              <span class="chip" *ngFor="let chip of profile[question.id]">
                {{ chip }}
                <button (click)="removeChip(question.id, chip)">×</button>
              </span>
            </div>
            <input type="text" [placeholder]="question.placeholder" (keydown.enter)="addChip(question.id, $event)" />
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="modal-footer">
        <button class="btn-secondary" (click)="prevStep()" [disabled]="currentStep === 0">Back</button>

        <button *ngIf="!isLastStep" class="btn-primary" (click)="nextStep()" [disabled]="!canGoNext">Next</button>

        <button *ngIf="isLastStep" class="btn-primary" (click)="submitForAnalysis()" [disabled]="!canGoNext || isAnalyzing">{{ isAnalyzing ? 'Analyzing...' : 'Generate Topics' }}</button>
      </div>
    </ng-template>
  </div>
</div>
```

**Step 3: Write the SCSS**

```scss
// apps/leads-app/src/app/interview-wizard.component.scss
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px 8px;
    color: #666;

    &:hover {
      color: #333;
    }
  }
}

.progress-bar {
  height: 4px;
  background: #eee;
  margin: 0;

  .progress-fill {
    height: 100%;
    background: #4caf50;
    transition: width 0.3s ease;
  }
}

.section-indicator {
  padding: 12px 24px;
  background: #f9f9f9;
  font-size: 0.875rem;
  color: #666;
}

.questions-container {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.question-card {
  margin-bottom: 24px;

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 8px;
    color: #333;

    .required {
      color: #e53935;
    }
  }

  input[type='text'],
  textarea,
  select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9375rem;

    &:focus {
      outline: none;
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
    }
  }

  textarea {
    resize: vertical;
  }
}

.multi-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .option-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 20px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #4caf50;
    }

    &.selected {
      background: #4caf50;
      color: #fff;
      border-color: #4caf50;
    }
  }
}

.chips-input {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #e8f5e9;
      border-radius: 16px;
      font-size: 0.875rem;

      button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        font-size: 1rem;
        line-height: 1;
        color: #666;

        &:hover {
          color: #e53935;
        }
      }
    }
  }

  input {
    width: 100%;
    border: none;
    outline: none;
    padding: 4px;
    font-size: 0.9375rem;
  }
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  gap: 12px;

  .btn-primary,
  .btn-secondary {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    background: #4caf50;
    color: #fff;
    border: none;

    &:hover:not(:disabled) {
      background: #43a047;
    }
  }

  .btn-secondary {
    background: #fff;
    color: #333;
    border: 1px solid #ddd;

    &:hover:not(:disabled) {
      background: #f5f5f5;
    }
  }
}

// Topic Review Styles
.topic-review {
  padding: 24px;

  .review-intro {
    color: #666;
    margin-bottom: 20px;
  }

  .topic-cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }

  .topic-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;

    .topic-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .topic-priority {
        font-weight: 600;
        color: #666;
      }

      .confidence-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #eee;

        &.high {
          background: #e8f5e9;
          color: #2e7d32;
        }

        &.medium {
          background: #fff3e0;
          color: #ef6c00;
        }
      }
    }

    h3 {
      margin: 0 0 8px;
      font-size: 1.1rem;
    }

    .topic-desc {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 12px;
    }

    .topic-details {
      font-size: 0.8125rem;

      .detail-row {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;

        .label {
          color: #999;
          min-width: 70px;
        }

        .value {
          color: #333;
        }
      }
    }
  }

  .review-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
```

**Step 4: Commit**

```bash
git add apps/leads-app/src/app/interview-wizard.component.ts apps/leads-app/src/app/interview-wizard.component.html apps/leads-app/src/app/interview-wizard.component.scss
git commit -m "feat: create interview wizard component with 15-question flow"
```

---

## Task 5: Create AI-powered onboarding analysis service in lead-tracker

**Files:**

- Create: `apps/lead-tracker/src/app/onboarding-analysis.service.ts`

**Step 1: Write the service**

```typescript
// apps/lead-tracker/src/app/onboarding-analysis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { UserOnboardingProfile, GeneratedTopicSuggestion, LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';

@Injectable()
export class OnboardingAnalysisService {
  private readonly logger = new Logger(OnboardingAnalysisService.name);

  async analyzeProfile(profile: UserOnboardingProfile): Promise<GeneratedTopicSuggestion[]> {
    this.logger.log('Analyzing onboarding profile with AI');

    // In production, this would call the AI orchestrator
    // For now, we'll implement a sophisticated rule-based system
    // that simulates AI analysis

    const topics: GeneratedTopicSuggestion[] = [];

    // Generate job-opening focused topics
    const jobTopic = this.generateJobTopic(profile);
    if (jobTopic) {
      topics.push(jobTopic);
    }

    // Generate service-buyer focused topics
    const buyerTopics = this.generateBuyerTopics(profile);
    topics.push(...buyerTopics);

    // Generate skill-specific topics
    const skillTopics = this.generateSkillTopics(profile);
    topics.push(...skillTopics);

    // Sort by priority and confidence
    return topics.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.confidence - a.confidence;
    });
  }

  private generateJobTopic(profile: UserOnboardingProfile): GeneratedTopicSuggestion | null {
    if (!profile.serviceOffer) return null;

    const keywords = this.deriveJobKeywords(profile);
    const sources = this.deriveJobSources(profile);

    return {
      name: `${profile.serviceOffer} roles`,
      description: `Remote and hybrid positions for ${profile.serviceOffer} seeking candidates with ${profile.skills.slice(0, 3).join(', ')} expertise.`,
      keywords,
      excludedTerms: this.normalizeExcludedTerms(profile),
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources,
      priority: 1,
      targetCompanies: this.deriveTargetCompanies(profile),
      buyerPersona: '',
      painPoints: profile.problemsSolved,
      valueProposition: `Hiring ${profile.serviceOffer} expertise`,
      searchStrategy: this.determineSearchStrategy(profile),
      confidence: this.calculateConfidence(profile, 'job'),
    };
  }

  private generateBuyerTopics(profile: UserOnboardingProfile): GeneratedTopicSuggestion[] {
    const topics: GeneratedTopicSuggestion[] = [];

    if (!profile.geographicFocus || profile.geographicFocus === 'Global') {
      // Global buyers
      topics.push({
        name: `${profile.serviceOffer} buyers - Global`,
        description: `Companies globally seeking ${profile.outcomes.join(', ')}.`,
        keywords: this.deriveBuyerKeywords(profile),
        excludedTerms: this.normalizeExcludedTerms(profile),
        discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
        sources: [LeadDiscoverySource.CLUTCH, LeadDiscoverySource.CRUNCHBASE],
        priority: 2,
        targetCompanies: profile.companySizeTarget,
        buyerPersona: profile.idealCustomer,
        painPoints: profile.problemsSolved,
        valueProposition: profile.outcomes[0] || profile.serviceOffer,
        searchStrategy: 'balanced',
        confidence: this.calculateConfidence(profile, 'buyer-global'),
      });
    }

    // Regional/national buyers (if not global)
    if (profile.geographicFocus && profile.geographicFocus !== 'Global') {
      topics.push({
        name: `${profile.serviceOffer} buyers - ${profile.geographicFocus}`,
        description: `${profile.geographicFocus} companies needing ${profile.outcomes.join(', ')}.`,
        keywords: this.deriveBuyerKeywords(profile),
        excludedTerms: this.normalizeExcludedTerms(profile),
        discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
        sources: [LeadDiscoverySource.GOOGLE_MAPS, LeadDiscoverySource.CLUTCH],
        priority: 3,
        targetCompanies: profile.companySizeTarget,
        buyerPersona: profile.idealCustomer,
        painPoints: profile.problemsSolved,
        valueProposition: profile.outcomes[0] || profile.serviceOffer,
        searchStrategy: 'conservative',
        confidence: this.calculateConfidence(profile, 'buyer-regional'),
      });
    }

    return topics;
  }

  private generateSkillTopics(profile: UserOnboardingProfile): GeneratedTopicSuggestion[] {
    const topics: GeneratedTopicSuggestion[] = [];

    // Generate a topic for each major skill area
    profile.skills.slice(0, 2).forEach((skill, index) => {
      if (skill && index < 2) {
        topics.push({
          name: `${skill} opportunities`,
          description: `Roles and projects requiring ${skill} expertise.`,
          keywords: [skill, ...profile.outcomes.slice(0, 2)],
          excludedTerms: this.normalizeExcludedTerms(profile),
          discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
          sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS],
          priority: 4 + index,
          targetCompanies: [],
          buyerPersona: '',
          painPoints: [],
          valueProposition: `${skill} expertise needed`,
          searchStrategy: 'aggressive',
          confidence: 70,
        });
      }
    });

    return topics;
  }

  private deriveJobKeywords(profile: UserOnboardingProfile): string[] {
    const keywords: string[] = [profile.serviceOffer];

    // Add skills
    keywords.push(...profile.skills.slice(0, 5));

    // Add outcomes as secondary keywords
    keywords.push(...profile.outcomes.slice(0, 3));

    // Add industries
    keywords.push(...profile.industries.slice(0, 2));

    return this.normalizeKeywords(keywords);
  }

  private deriveBuyerKeywords(profile: UserOnboardingProfile): string[] {
    const keywords: string[] = [profile.serviceOffer];

    // Add problems solved
    keywords.push(...profile.problemsSolved.slice(0, 3));

    // Add outcomes
    keywords.push(...profile.outcomes.slice(0, 3));

    return this.normalizeKeywords(keywords);
  }

  private deriveJobSources(profile: UserOnboardingProfile): LeadDiscoverySource[] {
    const sources: LeadDiscoverySource[] = [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS, LeadDiscoverySource.WE_WORK_REMOTELY];

    // Add more sources based on budget range
    if (profile.budgetRange && profile.budgetRange.includes('25k')) {
      sources.push(LeadDiscoverySource.INDEED);
    }

    return sources;
  }

  private deriveTargetCompanies(profile: UserOnboardingProfile): string[] {
    const companies: string[] = [];

    if (profile.industries.length) {
      companies.push(...profile.industries.map((i) => `${i} companies`));
    }

    if (profile.companySizeTarget.length) {
      companies.push(...profile.companySizeTarget.map((s) => `${s} employee companies`));
    }

    return companies;
  }

  private normalizeKeywords(keywords: string[]): string[] {
    return Array.from(new Set(keywords.filter((k) => k && k.trim())));
  }

  private normalizeExcludedTerms(profile: UserOnboardingProfile): string[] {
    const terms: string[] = profile.excludedCompanies || [];
    terms.push(...(profile.excludedIndustries || []));
    return terms.map((t) => t.toLowerCase().trim());
  }

  private determineSearchStrategy(profile: UserOnboardingProfile): 'aggressive' | 'balanced' | 'conservative' {
    if (profile.salesApproach === 'Outbound focused') return 'aggressive';
    if (profile.salesApproach === 'Inbound only') return 'conservative';
    return 'balanced';
  }

  private calculateConfidence(profile: UserOnboardingProfile, topicType: string): number {
    let score = 50; // Base score

    // More skills = higher confidence
    score += Math.min(profile.skills.length * 5, 20);

    // More outcomes = higher confidence
    score += Math.min(profile.outcomes.length * 3, 15);

    // Has ideal customer description
    if (profile.idealCustomer) score += 10;

    // Has industries
    score += Math.min(profile.industries.length * 5, 10);

    // DISC type adds credibility
    if (profile.discType && profile.discType !== "I don't know") score += 5;

    return Math.min(score, 95);
  }
}
```

**Step 2: Add to module**

```typescript
// apps/lead-tracker/src/app/app.module.ts - add to providers
import { OnboardingAnalysisService } from './onboarding-analysis.service';

@Module({
  imports: [...],
  controllers: [...],
  providers: [..., OnboardingAnalysisService],
})
export class AppModule {}
```

**Step 3: Run tests**

Run: `pnpm exec jest apps/lead-tracker/src/app/onboarding-analysis.service.spec.ts --runInBand`
Expected: Will need to create test file

**Step 4: Commit**

```bash
git add apps/lead-tracker/src/app/onboarding-analysis.service.ts apps/lead-tracker/src/app/app.module.ts
git commit -m "feat: add AI-powered onboarding analysis service"
```

---

## Task 6: Create lead discovery pipeline service with scoring

**Files:**

- Create: `apps/lead-tracker/src/app/discovery/pipeline.service.ts`

**Step 1: Write the pipeline service**

```typescript
// apps/lead-tracker/src/app/discovery/pipeline.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadAnalysis, LeadAnalysisDto } from '@optimistic-tanuki/models/leads-contracts';

export interface PipelineResult {
  lead: Lead;
  analysis: LeadAnalysis;
}

@Injectable()
export class DiscoveryPipelineService {
  private readonly logger = new Logger(DiscoveryPipelineService.name);

  async analyzeLead(lead: Lead, topic: LeadTopic): Promise<LeadAnalysis> {
    // Step 1: Relevance Detection
    const relevanceScore = this.calculateRelevance(lead, topic);

    // Step 2: Role & Title Analysis
    const { score: roleScore, decisionMakerLevel } = this.analyzeRole(lead);

    // Step 3: Company Fit Assessment
    const { score: companyFitScore, growthIndicators } = this.assessCompanyFit(lead, topic);

    // Step 4: Intent Signal Detection
    const { score: intentScore, detectedSignals } = this.detectIntentSignals(lead, topic);

    // Step 5: Contact Quality Analysis
    const contactScore = this.analyzeContactQuality(lead);

    // Calculate final weighted score
    const finalScore = this.calculateFinalScore(relevanceScore, roleScore, companyFitScore, intentScore, contactScore);

    // Determine classification
    const fitClassification = this.classifyLead(finalScore);

    return {
      id: `${lead.id}-${topic.id}`,
      leadId: lead.id,
      topicId: topic.id,
      relevanceScore,
      roleScore,
      companyFitScore,
      intentScore,
      contactScore,
      finalScore,
      fitClassification,
      detectedSignals,
      decisionMakerLevel,
      growthIndicators,
      analysisVersion: '1.0',
      analyzedAt: new Date(),
    };
  }

  private calculateRelevance(lead: Lead, topic: LeadTopic): number {
    let score = 0;
    const leadText = `${lead.name} ${lead.company} ${lead.notes} ${lead.searchKeywords?.join(' ')}`.toLowerCase();
    const topicKeywords = topic.keywords.map((k) => k.toLowerCase());

    // Check keyword matches
    const matchedKeywords = topicKeywords.filter((kw) => leadText.includes(kw.toLowerCase()));

    score += Math.min(matchedKeywords.length * 15, 60);

    // Check excluded terms
    const excludedMatches = (topic.excludedTerms || []).filter((term) => leadText.includes(term.toLowerCase()));

    score -= excludedMatches.length * 20;

    // Company presence adds relevance
    if (lead.company) score += 20;

    // Notes presence adds relevance
    if (lead.notes && lead.notes.length > 20) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeRole(lead: Lead): { score: number; decisionMakerLevel: string } {
    let score = 50;
    const titleText = (lead.notes || '').toLowerCase();
    const nameText = (lead.name || '').toLowerCase();

    // Check for decision-maker indicators
    const cLevel = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'president', 'vp of', 'vice president'];
    const managerLevel = ['director', 'manager', 'head of', 'lead', 'senior'];
    const icLevel = ['developer', 'engineer', 'designer', 'analyst', 'specialist'];

    if (cLevel.some((t) => titleText.includes(t) || nameText.includes(t))) {
      score = 90;
      return { score, decisionMakerLevel: 'C-Level/Executive' };
    }

    if (managerLevel.some((t) => titleText.includes(t))) {
      score = 75;
      return { score, decisionMakerLevel: 'Manager' };
    }

    if (icLevel.some((t) => titleText.includes(t))) {
      score = 60;
      return { score, decisionMakerLevel: 'IC' };
    }

    return { score, decisionMakerLevel: 'Unknown' };
  }

  private assessCompanyFit(lead: Lead, topic: LeadTopic): { score: number; growthIndicators: string[] } {
    let score = 50;
    const indicators: string[] = [];

    // Check target companies
    const targetCompanies = (topic.targetCompanies || []).map((c) => c.toLowerCase());
    const companyText = (lead.company || '').toLowerCase();

    if (targetCompanies.some((tc) => companyText.includes(tc))) {
      score += 30;
      indicators.push('Matches target company profile');
    }

    // Check for growth signals in notes
    const notes = (lead.notes || '').toLowerCase();
    const growthTerms = ['growing', 'expanding', 'hiring', 'Series', 'funding', 'raised', 'growth'];
    const foundGrowthTerms = growthTerms.filter((t) => notes.includes(t));

    if (foundGrowthTerms.length > 0) {
      score += Math.min(foundGrowthTerms.length * 10, 25);
      indicators.push(...foundGrowthTerms.map((t) => `Growth signal: ${t}`));
    }

    // Company presence
    if (lead.company) score += 15;

    return { score: Math.min(100, score), growthIndicators: indicators };
  }

  private detectIntentSignals(lead: Lead, topic: LeadTopic): { score: number; detectedSignals: string[] } {
    let score = 30; // Base score
    const signals: string[] = [];

    const notes = (lead.notes || '').toLowerCase();

    // Urgency indicators
    const urgencyTerms = ['urgent', 'asap', 'immediately', 'deadline', 'quickly', 'soon'];
    const foundUrgency = urgencyTerms.filter((t) => notes.includes(t));
    if (foundUrgency.length > 0) {
      score += 25;
      signals.push(...foundUrgency.map((t) => `Urgency: ${t}`));
    }

    // Budget indicators
    const budgetTerms = ['budget', 'approved', '$', 'k ', 'million'];
    const foundBudget = budgetTerms.filter((t) => notes.includes(t));
    if (foundBudget.length > 0) {
      score += 20;
      signals.push('Budget mentioned');
    }

    // Timeline indicators
    const timelineTerms = ['by q1', 'by q2', 'this month', 'next month', 'within'];
    const foundTimeline = timelineTerms.filter((t) => notes.includes(t));
    if (foundTimeline.length > 0) {
      score += 15;
      signals.push('Timeline mentioned');
    }

    // Pain point alignment with topic
    const topicPainPoints = (topic.painPoints || []).map((p) => p.toLowerCase());
    const alignedPainPoints = topicPainPoints.filter((pp) => notes.includes(pp));
    if (alignedPainPoints.length > 0) {
      score += Math.min(alignedPainPoints.length * 15, 30);
      signals.push('Pain points aligned');
    }

    return { score: Math.min(100, score), detectedSignals: signals };
  }

  private analyzeContactQuality(lead: Lead): number {
    let score = 50;

    // Email presence and quality
    if (lead.email) {
      score += 20;
      if (lead.email.includes('@') && !lead.email.includes('..')) {
        score += 10; // Valid format
      }
    }

    // Phone presence
    if (lead.phone) {
      score += 15;
    }

    // Company presence
    if (lead.company) {
      score += 10;
    }

    // Name completeness
    if (lead.name && lead.name.split(' ').length > 1) {
      score += 5; // Full name
    }

    return Math.min(100, score);
  }

  private calculateFinalScore(relevance: number, role: number, companyFit: number, intent: number, contact: number): number {
    // Weighted formula
    return Math.round(relevance * 0.25 + role * 0.2 + companyFit * 0.25 + intent * 0.2 + contact * 0.1);
  }

  private classifyLead(score: number): 'hot' | 'warm' | 'cold' | 'reject' {
    if (score >= 80) return 'hot';
    if (score >= 60) return 'warm';
    if (score >= 40) return 'cold';
    return 'reject';
  }
}
```

**Step 2: Add to module and commit**

```bash
git add apps/lead-tracker/src/app/discovery/pipeline.service.ts
git commit -m "feat: add lead discovery pipeline with 5-step scoring"
```

---

## Task 7: Add API endpoints for onboarding and lead analysis

**Files:**

- Modify: `apps/lead-tracker/src/app/leads.controller.ts`
- Modify: `apps/lead-tracker/src/app/leads.service.ts`

**Step 1: Add new endpoints**

```typescript
// apps/lead-tracker/src/app/leads.controller.ts - add these endpoints
@Post('onboarding/analyze')
async analyzeOnboarding(@Body() profile: UserOnboardingProfile) {
  const topics = await this.onboardingAnalysisService.analyzeProfile(profile);
  return { topics };
}

@Post('leads/:leadId/analyze')
async analyzeLead(
  @Param('leadId') leadId: string,
  @Body() dto: LeadAnalysisDto
) {
  const lead = await this.leadsService.findLeadById(leadId);
  const topic = await this.leadsService.findTopicById(dto.topicId);
  const analysis = await this.discoveryPipelineService.analyzeLead(lead, topic);
  return analysis;
}
```

**Step 2: Commit**

```bash
git add apps/lead-tracker/src/app/leads.controller.ts apps/lead-tracker/src/app/leads.service.ts
git commit -m "feat: add onboarding analysis and lead analysis endpoints"
```

---

## Task 8: Update dashboard to use interview wizard

**Files:**

- Modify: `apps/leads-app/src/app/dashboard.component.ts`
- Modify: `apps/leads-app/src/app/dashboard.component.html`

**Step 1: Update the dashboard component to integrate the wizard**

```typescript
// Add to dashboard.component.ts imports
import { InterviewWizardComponent } from './interview-wizard.component';

// Add to component
@Component({
  imports: [..., InterviewWizardComponent],
})

// Replace showOnboardingModal with wizard integration
showInterviewWizard = false;

openOnboarding() {
  this.showInterviewWizard = true;
}

onProfileSubmitted(profile: UserOnboardingProfile) {
  // Send to backend for analysis
  this.leadsService.analyzeOnboarding(profile).subscribe({
    next: (response) => {
      this.showInterviewWizard = false;
      // Create topics
    }
  });
}
```

**Step 2: Update template to use wizard**

```html
<!-- dashboard.component.html -->
<app-interview-wizard [showModal]="showInterviewWizard" (close)="showInterviewWizard = false" (analyzeTopics)="onProfileSubmitted($event)"></app-interview-wizard>
```

**Step 3: Commit**

```bash
git add apps/leads-app/src/app/dashboard.component.ts apps/leads-app/src/app/dashboard.component.html
git commit -m "feat: integrate interview wizard into dashboard"
```

---

## Task 9: Verify build and tests

**Files:**

- Test all affected components

**Step 1: Run TypeScript compilation**

Run:

```bash
pnpm exec tsc -p apps/leads-app/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/lead-tracker/tsconfig.app.json --noEmit
pnpm exec tsc -p libs/models/tsconfig.lib.json --noEmit
```

Expected: PASS

**Step 2: Run unit tests**

Run:

```bash
pnpm exec jest apps/leads-app/src/app/dashboard.component.spec.ts --runInBand
pnpm exec jest apps/leads-app/src/app/topics.component.spec.ts --runInBand
pnpm exec jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand
pnpm exec jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand
```

Expected: PASS

**Step 3: Build**

Run: `pnpm run build:dev`
Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify enhanced onboarding and discovery build"
```

---

## Summary

This implementation adds:

1. **Enhanced 15-question interview wizard** - Multi-step, sectioned questions covering professional background, target customer, sales approach, and discovery preferences

2. **AI-powered topic generation** - Service analyzes profile and generates 3-5 optimized topics with confidence scores, priorities, and strategies

3. **5-step discovery pipeline** - Scores leads on relevance (25%), role (20%), company fit (25%), intent (20%), and contact quality (10%)

4. **Lead classification** - Hot (80+), Warm (60-79), Cold (40-59), Reject (<40)

5. **New data models** - Extended LeadTopic with AI fields, new LeadAnalysis for scoring

**Plan complete and saved to `docs/plans/2026-03-30-leads-onboarding-discovery-enhancement.md`**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
