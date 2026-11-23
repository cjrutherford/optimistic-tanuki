import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { DirectoryAdminService } from '../services/directory-admin.service';

export interface SuspendedBinding {
  id: string;
  townId: string;
  townName: string | null;
  listing: { scanId: string; sourceFileRowNumber: string };
  provenance: string;
  stateCause: string | null;
  suspendedAt: string | null;
}
interface SuspendedBindingPage {
  bindings: SuspendedBinding[];
  total: number;
  nextCursor: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Directory → Suspended bindings. Reviewed bindings that were suspended when
 * their source stopped matching. Revalidate re-checks one against its source
 * and is safe to repeat, so it asks for a plain confirmation.
 */
@Component({
  selector: 'app-directory-suspended-bindings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './directory-suspended-bindings-page.component.html',
  styleUrls: ['./directory-suspended-bindings-page.component.scss'],
})
export class DirectorySuspendedBindingsPageComponent implements OnInit {
  private readonly admin = inject(DirectoryAdminService);
  private readonly confirm = inject(OwnerConfirmService);

  readonly bindings = signal<SuspendedBinding[]>([]);
  readonly total = signal(0);
  readonly nextCursor = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly actionError = signal('');
  readonly busyId = signal<string | null>(null);
  readonly filterError = signal('');
  townFilter = '';
  private appliedTown = '';

  ngOnInit(): void {
    this.load(false);
  }

  applyFilter(): void {
    const town = this.townFilter.trim();
    if (town && !UUID.test(town)) {
      this.filterError.set('A town id looks like 8-4-4-4-12 hexadecimal.');
      return;
    }
    this.filterError.set('');
    this.appliedTown = town;
    this.load(false);
  }

  loadMore(): void {
    this.load(true);
  }

  load(append: boolean): void {
    const cursor = append ? this.nextCursor() ?? undefined : undefined;
    this.loading.set(true);
    this.error.set('');
    this.admin
      .listSuspendedBindings<SuspendedBindingPage>({
        townId: this.appliedTown || undefined,
        cursor,
      })
      .subscribe({
        next: (page) => {
          this.bindings.set(
            append ? [...this.bindings(), ...page.bindings] : page.bindings
          );
          this.total.set(page.total);
          this.nextCursor.set(page.nextCursor);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Suspended bindings could not be loaded.');
        },
      });
  }

  async revalidate(binding: SuspendedBinding): Promise<void> {
    if (this.busyId()) return;
    const { confirmed } = await this.confirm.confirm({
      level: 'plain',
      title: 'Revalidate binding',
      body: `Re-check this binding for ${
        binding.townName ?? 'this town'
      } against its source. Its state is updated from the result.`,
      confirmLabel: 'Revalidate',
    });
    if (!confirmed) return;
    this.busyId.set(binding.id);
    this.actionError.set('');
    this.notice.set('');
    this.admin
      .revalidateBinding<{ bindingId: string; outcome: string }>(binding.id)
      .subscribe({
        next: (result) => {
          this.busyId.set(null);
          this.notice.set(`Revalidated: ${result.outcome}.`);
          this.load(false);
        },
        error: (err: { status?: number }) => {
          this.busyId.set(null);
          this.actionError.set(
            err?.status === 503
              ? 'Revalidation is unavailable: the source stage is not configured.'
              : 'The binding could not be revalidated.'
          );
        },
      });
  }
}
