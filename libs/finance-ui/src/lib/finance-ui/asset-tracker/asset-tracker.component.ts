import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateInventoryItem, InventoryItem } from '../models';
import { FinanceService } from '../services/finance.service';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-asset-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="assets">
      <header>
        <p class="eyebrow">Plan</p>
        <h1>Tracked Assets</h1>
      </header>

      <form class="editor" (ngSubmit)="saveAsset()">
        <input [(ngModel)]="draft.name" name="name" placeholder="Asset name" required />
        <input [(ngModel)]="draft.category" name="category" placeholder="Category" required />
        <input [(ngModel)]="draft.quantity" name="quantity" type="number" placeholder="Qty" required />
        <input [(ngModel)]="draft.unitValue" name="unitValue" type="number" placeholder="Value" required />
        <input [(ngModel)]="draft.location" name="location" placeholder="Location" />
        <button type="submit">{{ editingId() ? 'Update asset' : 'Add asset' }}</button>
      </form>

      <div class="grid">
        @for (asset of assets(); track asset.id) {
          <article class="card">
            <strong>{{ asset.name }}</strong>
            <span>{{ asset.category }} · {{ asset.location || 'No location' }}</span>
            <p>\${{ asset.totalValue }}</p>
            <div class="actions">
              <button type="button" (click)="editAsset(asset)">Edit</button>
              <button type="button" (click)="deleteAsset(asset.id)">Delete</button>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .assets { display:grid; gap:18px; color: var(--foreground, #1f2937); font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif); }
    .eyebrow { margin:0 0 8px; text-transform:uppercase; letter-spacing:.12em; font-size:12px; color: var(--muted, #6b7280); }
    h1 { margin:0; font-size:32px; font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif); }
    .editor { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; padding:18px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor input,.editor button { padding:10px 12px; border-radius: var(--border-radius-md, 12px); border:1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor button { background: var(--primary, #2563eb); color: var(--background, #ffffff); font-weight:700; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
    .card { padding:18px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); display:grid; gap:10px; }
    .card span { color: var(--muted, #6b7280); }
    .actions { display:flex; gap:8px; }
  `],
})
export class AssetTrackerComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  readonly assets = signal<InventoryItem[]>([]);
  readonly editingId = signal<string | null>(null);
  draft: Partial<CreateInventoryItem> = this.emptyDraft();

  async ngOnInit() {
    await this.loadAssets();
  }

  emptyDraft(): Partial<CreateInventoryItem> {
    return {
      name: '',
      category: '',
      quantity: 1,
      unitValue: 0,
      location: '',
      workspace: 'net-worth',
    };
  }

  async loadAssets() {
    try {
      this.assets.set(await this.financeService.getInventoryItems('net-worth'));
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }

      throw error;
    }
  }

  editAsset(asset: InventoryItem) {
    this.editingId.set(asset.id);
    this.draft = { ...asset };
  }

  async saveAsset() {
    const payload = {
      ...this.draft,
      workspace: 'net-worth',
    } as CreateInventoryItem;
    if (this.editingId()) {
      await this.financeService.updateInventoryItem(this.editingId()!, payload);
    } else {
      await this.financeService.createInventoryItem(payload);
    }
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await this.loadAssets();
  }

  async deleteAsset(id: string) {
    await this.financeService.deleteInventoryItem(id);
    await this.loadAssets();
  }
}
