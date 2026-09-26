import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
} from '@optimistic-tanuki/common-ui';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui';
import { JobDispatchStatus, JobRecord } from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';

@Component({
  selector: 'flow-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    TextAreaComponent,
  ],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly apiService = inject(FieldFlowApiService);
  readonly syncService = inject(FieldFlowSyncService);

  jobId = '';
  job: JobRecord | null = null;
  technicianInputNotes = '';
  showTechnicianConsole = false;
  isLoading = false;
  loadError = '';

  readonly statusSteps: {
    key: JobDispatchStatus;
    label: string;
    description: string;
  }[] = [
    {
      key: 'scheduled',
      label: 'Scheduled',
      description: 'Appointment confirmed with assigned mobile service crew.',
    },
    {
      key: 'en_route',
      label: 'En Route',
      description:
        'Technician van is dispatched and traveling to your location.',
    },
    {
      key: 'in_progress',
      label: 'Work in Progress',
      description:
        'On-site execution underway per confirmed package specifications.',
    },
    {
      key: 'completed',
      label: 'Completed',
      description: 'Service completed, final quality inspection signed off.',
    },
  ];

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get('id') || '';
    this.loadJob();
  }

  loadJob(): void {
    this.job = null;
    this.technicianInputNotes = '';
    this.loadError = '';
    this.isLoading = true;

    if (!this.jobId) {
      this.isLoading = false;
      return;
    }

    this.apiService.getJobStatus(this.jobId).subscribe({
      next: (jobData) => {
        this.job = jobData;
        this.technicianInputNotes = jobData.technicianNotes || '';
        this.isLoading = false;
      },
      error: () => {
        this.job = null;
        this.loadError = 'Unable to load job status. Please try again.';
        this.isLoading = false;
      },
    });
  }

  isStepActive(step: JobDispatchStatus): boolean {
    if (!this.job) return false;
    const order: JobDispatchStatus[] = [
      'scheduled',
      'en_route',
      'in_progress',
      'completed',
    ];
    const currentIndex = order.indexOf(this.job.status);
    const stepIndex = order.indexOf(step);
    return stepIndex <= currentIndex;
  }

  saveTechnicianNotes(): void {
    if (!this.job) return;
    this.job.technicianNotes = this.technicianInputNotes;
    void this.syncService.saveTechnicianNotes(
      this.job.id,
      this.technicianInputNotes,
      []
    );
  }

  toggleTechnicianConsole(): void {
    this.showTechnicianConsole = !this.showTechnicianConsole;
  }
}
