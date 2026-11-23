import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TownContextService } from '../../services/town-context.service';
import { CommunityOpsEntity } from './community-ops.model';
import { CommunityOpsDataService } from './community-ops-data.service';
import { OpsEntityDetailComponent } from './ops-entity-detail.component';
import { TOWN_OPS_STYLES } from './community-ops.styles';

/** One town: its state, direct actions, and the shared case/notes journal. */
@Component({
  selector: 'app-town-overview',
  standalone: true,
  imports: [OpsEntityDetailComponent],
  template: `
    <section class="ops-page">
      <header class="hero">
        <p class="hero-kicker">Town</p>
        <h1>{{ context.selected()?.name ?? 'Town overview' }}</h1>
        <p>{{ context.selected()?.subtitle }}</p>
      </header>
      @if (loading()) {
      <p role="status">Loading town…</p>
      } @else if (entity()) {
      <app-ops-entity-detail
        [entity]="entity()"
        [related]="[]"
      ></app-ops-entity-detail>
      } @else {
      <p role="alert">This town's details are unavailable right now.</p>
      }
    </section>
  `,
  styles: [TOWN_OPS_STYLES],
})
export class TownOverviewComponent implements OnInit {
  readonly context = inject(TownContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(CommunityOpsDataService);

  readonly townId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('townId'))),
    { initialValue: this.route.snapshot.paramMap.get('townId') }
  );
  readonly loading = signal(true);
  private readonly entities = signal<CommunityOpsEntity[]>([]);
  readonly entity = computed(() => {
    const matches = this.entities().filter(
      (entity) => entity.id === this.townId() && entity.entityType !== 'member'
    );
    return matches.find((e) => e.entityType === 'city') ?? matches[0] ?? null;
  });

  ngOnInit(): void {
    this.context.load();
    this.data.load().subscribe(({ entities }) => {
      this.entities.set(entities);
      this.loading.set(false);
    });
  }
}
