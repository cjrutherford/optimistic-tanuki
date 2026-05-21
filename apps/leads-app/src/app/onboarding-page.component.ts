import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DiscInterviewRequest,
  GeneratedTopicSuggestion,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { InterviewWizardComponent } from './interview-wizard.component';
import { LeadsService } from './leads.service';
import { OnboardingGateService } from './onboarding-gate.service';

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [CommonModule, InterviewWizardComponent],
  templateUrl: './onboarding-page.component.html',
  styleUrl: './onboarding-page.component.scss',
})
export class OnboardingPageComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly onboardingGateService = inject(OnboardingGateService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  @ViewChild(InterviewWizardComponent)
  private wizard?: InterviewWizardComponent;

  analysisError = '';
  confirmError = '';
  confirmingTopics = false;
  private latestProfile: UserOnboardingProfile | null = null;

  constructor() {
    this.themeService.setPersonality('control-center');
  }

  get errorMessage(): string {
    return this.confirmError || this.analysisError;
  }

  onAnalyzeTopics(profile: UserOnboardingProfile): void {
    this.analysisError = '';
    this.confirmError = '';
    this.latestProfile = profile;

    this.leadsService.analyzeOnboarding(profile).subscribe({
      next: (response) => {
        this.wizard?.onTopicsAnalyzed(response.topics);
      },
      error: () => {
        this.analysisError = 'Unable to analyze your profile. Please try again.';
        this.wizard?.onAnalysisFailed();
      },
    });
  }

  onAnalyzeMadLib(text: string): void {
    this.analysisError = '';
    this.leadsService.analyzeMadLib(text).subscribe({
      next: (response) => {
        this.wizard?.onMadLibAnalyzed(response);
      },
      error: () => {
        this.analysisError = 'Unable to analyze that description right now.';
        this.wizard?.onMadLibFailed();
      },
    });
  }

  onParseResume(file: File): void {
    this.analysisError = '';
    this.leadsService.parseResume(file).subscribe({
      next: (response) => {
        this.wizard?.onResumeParsed(response);
      },
      error: () => {
        this.analysisError = 'Unable to parse your resume right now.';
        this.wizard?.onResumeParseFailed();
      },
    });
  }

  onAdvanceDiscInterview(request: DiscInterviewRequest): void {
    this.analysisError = '';
    this.leadsService.advanceDiscInterview(request).subscribe({
      next: (response) => {
        this.wizard?.onDiscAdvanced(response);
      },
      error: () => {
        this.analysisError = 'Unable to continue the DISC interview right now.';
        this.wizard?.onDiscAdvanceFailed();
      },
    });
  }

  onConfirmTopics(topics: GeneratedTopicSuggestion[]): void {
    if (!this.latestProfile) {
      this.confirmError = 'Your onboarding profile is missing. Please analyze again.';
      return;
    }
    this.confirmingTopics = true;
    this.confirmError = '';
    this.analysisError = '';

    this.leadsService.confirmOnboarding(this.latestProfile, topics).subscribe({
      next: () => {
        this.confirmingTopics = false;
        this.onboardingGateService.markComplete();
        void this.router.navigateByUrl('/topics');
      },
      error: () => {
        this.confirmingTopics = false;
        this.confirmError = 'Unable to create your topics right now.';
      },
    });
  }
}
