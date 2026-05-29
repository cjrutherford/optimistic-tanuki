import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-client-routines-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="stack">
      <otui-card>
        <h2>Assigned routines</h2>
        <div class="list">
          @for (routine of routines(); track routine.id) {
          <div class="routine">
            <div class="routine-head">
              <strong>{{ routine.title }}</strong>
              @if (routine.status === 'completed') {
              <span class="status-pill">Completed</span>
              }
            </div>
            <p>{{ routine.summary }}</p>
            @if (allowClientCompletion() && routine.status !== 'completed') {
            <otui-button
              variant="outlined"
              (action)="completeRoutine(routine.id)"
            >
              Mark complete
            </otui-button>
            }
          </div>
          } @empty {
          <p class="empty">
            Assigned routines will appear here once your coach publishes them.
          </p>
          }
        </div>
      </otui-card>

      <otui-card>
        <h2>Submit a check-in</h2>
        <form class="form" (ngSubmit)="submitCheckIn()">
          <label>
            Routine
            <select [(ngModel)]="assignmentId" name="assignmentId">
              @for (routine of routines(); track routine.id) {
              <option [value]="routine.id">{{ routine.title }}</option>
              }
            </select>
          </label>
          <label>
            Energy
            <input
              [(ngModel)]="energy"
              name="energy"
              type="number"
              min="1"
              max="10"
            />
          </label>
          <label>
            Notes
            <textarea [(ngModel)]="notes" name="notes"></textarea>
          </label>
          <otui-button type="submit" variant="primary"
            >Save check-in</otui-button
          >
        </form>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .stack {
        display: grid;
        gap: 1rem;
      }
      .list,
      .form {
        display: grid;
        gap: 0.8rem;
      }
      label,
      .routine {
        display: grid;
        gap: 0.35rem;
      }
      .routine-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      input,
      select,
      textarea {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: var(--personality-input-border-width, 1px) solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
      }
      .empty,
      .routine p {
        color: var(--muted);
        margin: 0;
      }
      .status-pill {
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--primary, #1f7a63);
        background: color-mix(
          in srgb,
          var(--primary, #1f7a63) 10%,
          transparent
        );
      }
    `,
  ],
})
export class BusinessClientTasksPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly clientId = computed(
    () => this.auth.clientUser()?.userId ?? ''
  );
  readonly allowClientCompletion = computed(
    () => this.siteConfig.site().features.clientTasks.allowClientCompletion
  );
  readonly routines = signal<any[]>([]);
  assignmentId = '';
  energy = 7;
  notes = 'Strong session and solid recovery.';

  constructor() {
    effect(() => {
      const id = this.clientId();
      if (!id) {
        this.routines.set([]);
        return;
      }

      this.api.getClientRoutines(id).subscribe((routines) => {
        this.routines.set(routines);
      });
    });
  }

  submitCheckIn(): void {
    if (!this.assignmentId) {
      return;
    }

    this.api
      .submitCheckIn({
        clientId: this.auth.clientUser()?.userId ?? '',
        assignmentId: this.assignmentId,
        notes: this.notes,
        energy: this.energy,
      })
      .subscribe(() => {
        this.notes = 'Check-in saved.';
      });
  }

  completeRoutine(id: string): void {
    if (!this.allowClientCompletion()) {
      return;
    }

    this.api.completeClientRoutine(id).subscribe((updatedRoutine) => {
      this.routines.update((routines) =>
        routines.map((routine) =>
          routine.id === id
            ? {
                ...routine,
                ...updatedRoutine,
                status: updatedRoutine?.status ?? 'completed',
              }
            : routine
        )
      );
    });
  }
}
