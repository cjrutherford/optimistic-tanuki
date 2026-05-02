import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { TrainerApiService, TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-client-routines-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="stack">
      <otui-card>
        <h2>Assigned routines</h2>
        <div class="list">
          @for (routine of routines(); track routine.id) {
            <div class="routine">
              <strong>{{ routine.title }}</strong>
              <p>{{ routine.summary }}</p>
            </div>
          } @empty {
            <p class="empty">Assigned routines will appear here once your coach publishes them.</p>
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
            <input [(ngModel)]="energy" name="energy" type="number" min="1" max="10" />
          </label>
          <label>
            Notes
            <textarea [(ngModel)]="notes" name="notes"></textarea>
          </label>
          <otui-button type="submit" variant="primary">Save check-in</otui-button>
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
    `,
  ],
})
export class TrainerClientRoutinesPageComponent {
  private readonly api = inject(TrainerApiService);
  private readonly auth = inject(TrainerAuthService);
  private readonly clientId = computed(() => this.auth.clientUser()?.profileId ?? '');
  readonly routines = toSignal(
    toObservable(this.clientId).pipe(
      switchMap(id => id ? this.api.getClientRoutines(id) : of([]))
    ),
    { initialValue: [] }
  );
  assignmentId = '';
  energy = 7;
  notes = 'Strong session and solid recovery.';

  submitCheckIn(): void {
    if (!this.assignmentId) {
      return;
    }

    this.api
      .submitCheckIn({
        clientId: this.auth.clientUser()?.profileId ?? '',
        assignmentId: this.assignmentId,
        notes: this.notes,
        energy: this.energy,
      })
      .subscribe(() => {
        this.notes = 'Check-in saved.';
      });
  }
}
