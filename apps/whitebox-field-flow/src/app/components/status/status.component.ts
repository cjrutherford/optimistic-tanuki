import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { JobDispatchStatus, JobRecord } from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

@Component({
  selector: 'flow-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './status.component.html',
  styleUrl: './status.component.scss',
})
export class StatusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly apiService = inject(FieldFlowApiService);
  readonly syncService = inject(FieldFlowSyncService);
  readonly brandConfig = inject(BrandConfigService);

  jobId = '';
  job: JobRecord | null = null;
  technicianInputNotes = '';
  showTechnicianConsole = false;

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
    this.jobId = this.route.snapshot.paramMap.get('id') || 'demo-job';
    this.loadJob();
  }

  loadJob(): void {
    this.apiService.getJobStatus(this.jobId).subscribe((jobData) => {
      this.job = jobData;
      if (this.job && this.job.technicianNotes) {
        this.technicianInputNotes = this.job.technicianNotes;
      }
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

  updateJobStatus(newStatus: JobDispatchStatus): void {
    if (!this.job) return;
    this.job.status = newStatus;
    if (newStatus === 'completed') {
      this.job.completedAt = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    void this.syncService.cacheAppointment(this.job);
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
