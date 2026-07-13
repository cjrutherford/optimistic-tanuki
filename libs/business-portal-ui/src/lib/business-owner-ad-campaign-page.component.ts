import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BusinessApiService,
  OwnerAdvertisingCampaignRecord,
  OwnerBusinessPageRecord,
  SponsorChannelOption,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { firstValueFrom } from 'rxjs';

type Placement = 'pre-roll' | 'mid-roll' | 'post-roll' | 'on-page';
type TargetType = 'channel' | 'community';

@Component({
  selector: 'business-owner-ad-campaign-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="campaign-studio">
      <header>
        <p>Advertising</p>
        <h1>Campaign control room</h1>
        <span
          >Build one local campaign across the places your audience actually
          gathers.</span
        >
      </header>
      <div class="grid">
        <otui-card>
          <form (ngSubmit)="save()">
            <h2>Campaign brief</h2>
            <label
              >Name <input [(ngModel)]="name" name="name" required
            /></label>
            <label
              >Business
              <select [(ngModel)]="businessPageId" name="business">
                <option *ngFor="let page of businessPages()" [value]="page.id">
                  {{ page.name || page.communityId }}
                </option>
              </select></label
            >
            <label
              >Budget
              <input type="number" min="0" [(ngModel)]="budget" name="budget"
            /></label>
            <div class="dates">
              <label
                >Starts
                <input
                  type="date"
                  [(ngModel)]="startsAt"
                  name="starts" /></label
              ><label
                >Ends <input type="date" [(ngModel)]="endsAt" name="ends"
              /></label>
            </div>
            <h2>Targets and placements</h2>
            <p class="hint">
              Channels may carry video rolls and on-page ads. Communities are
              on-page only.
            </p>
            <div class="targets">
              <div *ngFor="let channel of channels()" class="target">
                <label
                  ><input
                    type="checkbox"
                    [checked]="selected(channel.id)"
                    (change)="
                      toggleTarget(
                        'channel',
                        channel.id,
                        $any($event.target).checked
                      )
                    "
                  />
                  {{ channel.name }}</label
                >
                <div *ngIf="selected(channel.id)" class="placements">
                  <label
                    *ngFor="let placement of placementsForTarget('channel')"
                    ><input
                      type="checkbox"
                      [checked]="hasPlacement(channel.id, placement)"
                      (change)="
                        togglePlacement(
                          channel.id,
                          placement,
                          $any($event.target).checked
                        )
                      "
                    />
                    {{ placement }}</label
                  >
                </div>
              </div>
              <div *ngFor="let page of businessPages()" class="target">
                <label
                  ><input
                    type="checkbox"
                    [checked]="selected(page.communityId)"
                    (change)="
                      toggleTarget(
                        'community',
                        page.communityId,
                        $any($event.target).checked
                      )
                    "
                  />
                  {{ page.name || page.communityId }} community</label
                >
                <div *ngIf="selected(page.communityId)" class="placements">
                  <label
                    ><input
                      type="checkbox"
                      [checked]="hasPlacement(page.communityId, 'on-page')"
                      (change)="
                        togglePlacement(
                          page.communityId,
                          'on-page',
                          $any($event.target).checked
                        )
                      "
                    />
                    on-page</label
                  >
                </div>
              </div>
            </div>
            <h2>Creative by placement</h2>
            <p class="hint" *ngIf="selectedPlacements().length === 0">
              Select target placements to configure creative.
            </p>
            <fieldset
              *ngFor="let placement of selectedPlacements()"
              class="creative"
              [attr.data-placement]="placement"
            >
              <legend>{{ placement }}</legend>
              <label
                >Headline
                <input
                  [(ngModel)]="creativeDrafts[placement].headline"
                  [name]="placement + '-headline'"
              /></label>
              <label
                >Body
                <textarea
                  [(ngModel)]="creativeDrafts[placement].body"
                  [name]="placement + '-body'"
                ></textarea>
              </label>
              <label
                >CTA label
                <input
                  [(ngModel)]="creativeDrafts[placement].ctaLabel"
                  [name]="placement + '-cta-label'"
              /></label>
              <label
                >CTA URL
                <input
                  [(ngModel)]="creativeDrafts[placement].ctaUrl"
                  [name]="placement + '-cta-url'"
              /></label>
            </fieldset>
            <p class="error" *ngIf="message()">{{ message() }}</p>
            <otui-button type="submit">{{
              editingId() ? 'Save campaign draft' : 'Create draft campaign'
            }}</otui-button
            ><otui-button
              *ngIf="editingId()"
              type="button"
              variant="outlined"
              (action)="resetForm()"
              >Cancel edit</otui-button
            >
          </form>
        </otui-card>
        <otui-card
          ><h2>Campaigns</h2>
          <div
            class="campaign"
            *ngFor="let campaign of campaigns()"
            [attr.data-campaign-id]="campaign.id"
          >
            <strong>{{ campaign.name }}</strong
            ><span
              >{{ campaign.status }} ·
              {{ campaign.targetPlacements.length }} placements</span
            ><otui-button
              type="button"
              variant="outlined"
              *ngIf="campaign.status !== 'archived'"
              (action)="edit(campaign)"
              >Edit</otui-button
            ><otui-button
              type="button"
              variant="outlined"
              *ngIf="
                campaign.status === 'draft' || campaign.status === 'paused'
              "
              (action)="setStatus(campaign, 'active')"
              >Activate</otui-button
            ><otui-button
              type="button"
              variant="outlined"
              *ngIf="campaign.status === 'active'"
              (action)="setStatus(campaign, 'paused')"
              >Pause</otui-button
            ><otui-button
              type="button"
              variant="outlined"
              *ngIf="campaign.status !== 'archived'"
              (action)="setStatus(campaign, 'archived')"
              >Archive</otui-button
            >
          </div>
          <p *ngIf="campaigns().length === 0">No campaigns yet.</p></otui-card
        >
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .campaign-studio {
        max-width: 1180px;
        margin: auto;
        padding: 2rem;
        color: var(--foreground, #17222f);
      }
      header {
        padding: 1.75rem 0 2rem;
        border-bottom: 3px solid #e36c37;
      }
      header p {
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #bb4c20;
        font-weight: 700;
        margin: 0;
      }
      h1 {
        font: 700 clamp(2rem, 5vw, 4rem) / 0.95 Georgia, serif;
        margin: 0.35rem 0;
      }
      header span,
      .hint {
        color: #526170;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.35fr 0.65fr;
        gap: 1.25rem;
        margin-top: 1.5rem;
      }
      form {
        display: grid;
        gap: 0.85rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 650;
      }
      input,
      select,
      textarea {
        font: inherit;
        padding: 0.65rem;
        border: 1px solid #b8c2c9;
        border-radius: 0.35rem;
      }
      .dates {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .targets {
        border-top: 1px solid #d7dfe2;
      }
      .target {
        padding: 0.75rem 0;
        border-bottom: 1px solid #d7dfe2;
      }
      .target > label {
        display: block;
      }
      .placements {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        margin: 0.6rem 0 0 1.5rem;
      }
      .placements label {
        display: block;
        font-size: 0.9rem;
      }
      .creative {
        display: grid;
        gap: 0.65rem;
        border: 1px solid #d7dfe2;
        border-radius: 0.5rem;
        padding: 1rem;
      }
      .creative legend {
        font-weight: 750;
        color: #bb4c20;
      }
      .campaign {
        display: grid;
        gap: 0.5rem;
        padding: 1rem 0;
        border-bottom: 1px solid #d7dfe2;
      }
      .campaign span {
        color: #63717b;
      }
      .error {
        color: #a52a14;
      }
      @media (max-width: 800px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .dates {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessOwnerAdCampaignPageComponent {
  private readonly api = inject(BusinessApiService);
  readonly businessPages = signal<OwnerBusinessPageRecord[]>([]);
  readonly channels = signal<SponsorChannelOption[]>([]);
  readonly campaigns = signal<OwnerAdvertisingCampaignRecord[]>([]);
  readonly message = signal('');
  readonly editingId = signal<string | null>(null);
  name = '';
  businessPageId = '';
  budget: number | null = null;
  creativeDrafts: Record<
    Placement,
    { headline: string; body: string; ctaLabel: string; ctaUrl: string }
  > = this.emptyCreatives();
  startsAt = new Date().toISOString().slice(0, 10);
  endsAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  private readonly targets = signal<
    Record<string, { type: TargetType; placements: Placement[] }>
  >({});
  readonly selectedPlacements = computed(() => [
    ...new Set(
      Object.values(this.targets()).flatMap((target) => target.placements)
    ),
  ]);

  static placementsForTarget(type: TargetType): Placement[] {
    return type === 'community'
      ? ['on-page']
      : ['pre-roll', 'mid-roll', 'post-roll', 'on-page'];
  }
  placementsForTarget(type: TargetType) {
    return BusinessOwnerAdCampaignPageComponent.placementsForTarget(type);
  }
  selected(id: string) {
    return !!this.targets()[id];
  }
  hasPlacement(id: string, placement: Placement) {
    return this.targets()[id]?.placements.includes(placement) ?? false;
  }
  toggleTarget(type: TargetType, id: string, checked: boolean) {
    this.targets.update((targets) => {
      const next = { ...targets };
      if (checked) next[id] = { type, placements: ['on-page'] };
      else delete next[id];
      return next;
    });
  }
  togglePlacement(id: string, placement: Placement, checked: boolean) {
    this.targets.update((targets) => ({
      ...targets,
      [id]: {
        ...targets[id],
        placements: checked
          ? [...new Set([...targets[id].placements, placement])]
          : targets[id].placements.filter((value) => value !== placement),
      },
    }));
  }
  constructor() {
    void this.reload();
  }
  async save() {
    const targetPlacements = Object.entries(this.targets()).flatMap(
      ([targetId, target]) =>
        target.placements.map((placementType) => ({
          targetId,
          targetType: target.type,
          placementType,
        }))
    );
    if (!this.businessPageId || !this.name || targetPlacements.length === 0) {
      this.message.set(
        'Choose a business, name, and at least one target placement.'
      );
      return;
    }
    const payload = {
      businessPageId: this.businessPageId,
      name: this.name,
      budget: this.budget,
      startsAt: new Date(this.startsAt).toISOString(),
      endsAt: new Date(this.endsAt).toISOString(),
      targetPlacements,
      creatives: this.selectedPlacements().map((placementType) => ({
        placementType,
        ...this.creativeDrafts[placementType],
      })),
    };
    const editingId = this.editingId();
    if (editingId)
      await firstValueFrom(
        this.api.updateAdvertisingCampaign(editingId, payload)
      );
    else await firstValueFrom(this.api.createAdvertisingCampaign(payload));
    await this.reload();
    this.resetForm();
    this.message.set(
      editingId ? 'Campaign saved as a draft.' : 'Draft campaign created.'
    );
  }
  edit(campaign: OwnerAdvertisingCampaignRecord) {
    this.editingId.set(campaign.id);
    this.name = campaign.name;
    this.businessPageId = campaign.businessPageId;
    this.budget = campaign.budget ?? null;
    this.startsAt = new Date(campaign.startsAt).toISOString().slice(0, 10);
    this.endsAt = new Date(campaign.endsAt).toISOString().slice(0, 10);
    const targets: Record<
      string,
      { type: TargetType; placements: Placement[] }
    > = {};
    for (const target of campaign.targetPlacements) {
      const current = targets[target.targetId] ?? {
        type: target.targetType,
        placements: [],
      };
      current.placements.push(target.placementType);
      targets[target.targetId] = current;
    }
    this.targets.set(targets);
    this.creativeDrafts = this.emptyCreatives();
    for (const creative of campaign.creatives)
      this.creativeDrafts[creative.placementType] = {
        headline: creative.headline ?? '',
        body: creative.body ?? '',
        ctaLabel: creative.ctaLabel ?? '',
        ctaUrl: creative.ctaUrl ?? '',
      };
    this.message.set('');
  }
  resetForm() {
    this.editingId.set(null);
    this.name = '';
    this.budget = null;
    this.targets.set({});
    this.creativeDrafts = this.emptyCreatives();
  }
  async setStatus(
    campaign: OwnerAdvertisingCampaignRecord,
    status: 'active' | 'paused' | 'archived'
  ) {
    await firstValueFrom(
      this.api.updateAdvertisingCampaignStatus(campaign.id, status)
    );
    await this.reload();
  }
  private emptyCreatives() {
    return Object.fromEntries(
      BusinessOwnerAdCampaignPageComponent.placementsForTarget('channel').map(
        (placement) => [
          placement,
          { headline: '', body: '', ctaLabel: '', ctaUrl: '' },
        ]
      )
    ) as Record<
      Placement,
      { headline: string; body: string; ctaLabel: string; ctaUrl: string }
    >;
  }
  private async reload() {
    const [businessPages, channels, campaigns] = await Promise.all([
      firstValueFrom(this.api.getOwnerBusinessPages()),
      firstValueFrom(this.api.getSponsorChannels()),
      firstValueFrom(this.api.getOwnerAdvertisingCampaigns()),
    ]);
    this.businessPages.set(businessPages);
    this.channels.set(channels);
    this.campaigns.set(campaigns);
    this.businessPageId ||= businessPages[0]?.id || '';
  }
}
