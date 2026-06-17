import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BusinessOffer,
  BusinessApiService,
  BusinessAuthService,
  BusinessBusyWindow,
  BusinessClientBookingStatus,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import {
  Availability,
  AvailabilityOverride,
} from '@optimistic-tanuki/ui-models';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

export const businessBookingPageStyles = `
      :host {
        display: block;
        --booking-copy-surface: #fff8f0;
        --booking-form-surface: #ffffff;
        --booking-copy-ink: #18241f;
        --booking-copy-muted: #4d5c68;
        --booking-accent: var(--primary, #1f7a63);
        --booking-accent-soft: #e5efe9;
        --booking-border: rgba(24, 36, 31, 0.12);
        --booking-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
      }

      :host-context([data-mode='dark']) {
        --booking-copy-surface: color-mix(
          in srgb,
          var(--surface, #1a221d) 88%,
          var(--background, #111714)
        );
        --booking-form-surface: color-mix(
          in srgb,
          var(--surface, #1a221d) 94%,
          var(--background, #111714)
        );
        --booking-copy-ink: var(--foreground, #edf3ef);
        --booking-copy-muted: color-mix(
          in srgb,
          var(--foreground, #edf3ef) 72%,
          transparent
        );
        --booking-accent-soft: color-mix(
          in srgb,
          var(--primary, #3ea68a) 18%,
          var(--surface, #1a221d)
        );
        --booking-border: rgba(237, 243, 239, 0.12);
        --booking-shadow: 0 28px 60px rgba(0, 0, 0, 0.3);
      }

      :host-context([data-mode='light']) {
        --booking-copy-surface: #fff8f0;
        --booking-form-surface: #ffffff;
        --booking-copy-ink: #18241f;
        --booking-copy-muted: #4d5c68;
        --booking-accent-soft: #e5efe9;
        --booking-border: rgba(24, 36, 31, 0.12);
        --booking-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 0.82fr) minmax(320px, 1fr);
        align-items: start;
        gap: 1rem;
      }

      .copy,
      .form-shell {
        border: 1px solid var(--booking-border);
        border-radius: clamp(1.25rem, 2vw, 1.8rem);
        box-shadow: var(--booking-shadow);
      }

      .copy {
        display: grid;
        gap: 0.9rem;
        background:
          linear-gradient(
            160deg,
            var(--booking-copy-surface) 0%,
            color-mix(in srgb, var(--booking-copy-surface) 86%, var(--booking-accent-soft))
              100%
          );
        color: var(--booking-copy-ink);
        padding: clamp(1.25rem, 2vw, 1.8rem);
        position: sticky;
        top: 1rem;
      }

      .copy p,
      .support-copy,
      .availability-note,
      .message {
        margin: 0;
        color: var(--booking-copy-muted);
      }

      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--booking-accent);
      }

      h1 {
        margin: 0;
        color: var(--booking-copy-ink);
        font-family: var(--font-heading, 'Source Sans Pro', system-ui, sans-serif);
        font-size: clamp(2.1rem, 4vw, 3.2rem);
        font-weight: 700;
        line-height: 0.98;
        max-width: 10ch;
      }

      .copy-stack {
        display: grid;
        gap: 0.75rem;
      }

      .booking-highlights {
        display: grid;
        gap: 0.65rem;
        padding: 0.95rem 1rem;
        border-radius: 1rem;
        background: color-mix(
          in srgb,
          var(--booking-accent-soft) 78%,
          transparent
        );
      }

      .booking-highlights strong {
        color: var(--booking-copy-ink);
        font-size: 0.84rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .booking-highlights ul {
        margin: 0;
        padding-left: 1rem;
        display: grid;
        gap: 0.4rem;
        color: var(--booking-copy-muted);
      }

      .cta-link {
        width: fit-content;
        color: var(--booking-accent);
        font-weight: 700;
        text-decoration: none;
      }

      .form-shell {
        background: var(--booking-form-surface);
      }

      .form {
        display: grid;
        gap: 0.9rem;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .field-grid .field-span,
      .field-stack {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.35rem;
        color: var(--booking-copy-ink);
        font-weight: 700;
      }

      input,
      textarea,
      select {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: var(--personality-input-border-width, 1px) solid var(--booking-border);
        background: color-mix(in srgb, var(--booking-form-surface) 92%, transparent);
        color: var(--booking-copy-ink);
      }

      textarea {
        min-height: 140px;
        resize: vertical;
      }

      .message {
        font-size: 0.95rem;
      }

      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .copy {
          position: static;
        }
      }

      @media (max-width: 640px) {
        .field-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

type BookableSlot = {
  key: string;
  availabilityId: string;
  serviceType: string;
  start: Date;
  end: Date;
  label: string;
};

@Component({
  selector: 'business-booking-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonComponent,
    CardComponent,
  ],
  template: `
    <section class="layout">
      <div class="copy">
        <p class="eyebrow">Relationship Setup</p>
        <h1>{{ pageTitle() }}</h1>
        <div class="copy-stack">
          <p>{{ introCopy() }}</p>
          <p class="support-copy">
            {{ nextActionCopy() }}
          </p>
        </div>
        <div class="booking-highlights">
          <strong>What happens next</strong>
          <ul>
            @if (isAcceptedClient()) {
            <li>Choose a published time and submit the booking request.</li>
            <li>The business confirms fit and approves the schedule.</li>
            <li>
              Your client workspace keeps the next session and billing visible.
            </li>
            } @else {
            <li>Share your goals and preferred timing.</li>
            <li>The business reviews scope before booking opens.</li>
            <li>Create or use your client account to track next steps.</li>
            }
          </ul>
        </div>
        @if (!auth.clientUser()) {
        <p class="support-copy">
          Create an account to track your request and access the client
          workspace.
        </p>
        <a class="cta-link" [routerLink]="registerRoute()">Create account</a>
        }
      </div>

      <otui-card class="form-shell">
        <form class="form" (ngSubmit)="submit()">
          <div class="field-grid">
            <label>
              Name
              <input [(ngModel)]="form.name" name="name" autocomplete="name" />
            </label>
            <label>
              Email
              <input
                [(ngModel)]="form.email"
                name="email"
                type="email"
                autocomplete="email"
              />
            </label>
            <label>
              Phone
              <input
                [(ngModel)]="form.phone"
                name="phone"
                type="tel"
                autocomplete="tel"
              />
            </label>
            <label>
              Available hour block
              <select [(ngModel)]="selectedSlotKey" name="selectedSlotKey">
                <option value="">Choose a published time</option>
                @for (slot of availableSlots(); track slot.key) {
                <option [value]="slot.key">{{ slot.label }}</option>
                }
              </select>
            </label>
            @if (offers().length) {
            <label class="field-span">
              Requested offer
              <select [(ngModel)]="selectedOfferId" name="selectedOfferId">
                <option value="">Choose an offer later</option>
                @for (offer of offers(); track offer.id) {
                <option [value]="offer.id">{{ offer.label }}</option>
                }
              </select>
            </label>
            }
            <label class="field-span">
              Primary goal
              <input [(ngModel)]="form.goal" name="goal" />
            </label>
            @if (!availableSlots().length) {
            <p class="message availability-note field-span">
              Booking opens when the owner publishes availability. You can still
              submit a request for follow-up.
            </p>
            }
            <label class="field-stack">
              Context
              <textarea [(ngModel)]="form.context" name="context"></textarea>
            </label>
          </div>
          <otui-button type="submit" variant="primary">{{
            submitLabel()
          }}</otui-button>
          @if (message()) {
          <p class="message">{{ message() }}</p>
          }
        </form>
      </otui-card>
    </section>
  `,
  styles: [businessBookingPageStyles],
})
export class BusinessBookingPageComponent {
  private readonly api = inject(BusinessApiService);
  protected readonly auth = inject(BusinessAuthService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly siteSlug = this.route?.snapshot.paramMap.get('siteSlug') ?? null;

  readonly site = computed(() => this.siteConfig.site());
  readonly message = signal('');
  readonly isClientAuthenticated = this.auth.isClientAuthenticated;
  readonly isAcceptedClient = signal(false);
  readonly clientStatus = signal<BusinessClientBookingStatus | null>(null);
  readonly offers = signal<BusinessOffer[]>([]);
  readonly availabilities = signal<Availability[]>([]);
  readonly availabilityOverrides = signal<AvailabilityOverride[]>([]);
  readonly busyWindows = signal<BusinessBusyWindow[]>([]);
  readonly selectedOffer = computed(
    () =>
      this.offers().find((offer) => offer.id === this.selectedOfferId) ?? null
  );
  selectedSlotKey = '';
  selectedOfferId = '';
  readonly availableSlots = computed(() =>
    this.buildAvailableSlots(
      this.availabilities(),
      this.availabilityOverrides(),
      this.busyWindows()
    )
  );
  readonly registerRoute = computed(() =>
    this.siteSlug
      ? ['/sites', this.siteSlug, 'client', 'register']
      : ['/client/register']
  );
  readonly pageTitle = computed(() =>
    this.isAcceptedClient() ? 'Book session' : 'Request consultation'
  );
  readonly introCopy = computed(() =>
    this.isAcceptedClient()
      ? 'Choose the right published time for your next session and send it in for approval.'
      : 'Tell us what you need and when you would like to get started. We review every request before confirming a schedule.'
  );
  readonly nextActionCopy = computed(
    () =>
      this.clientStatus()?.nextAction ||
      'Share your goals to request a consultation and start the review process.'
  );
  readonly submitLabel = computed(() =>
    this.isAcceptedClient() ? 'Book session' : 'Request consultation'
  );
  readonly form = {
    name: '',
    email: '',
    phone: '',
    goal: '',
    context: '',
    preferredStart: '',
    preferredEnd: '',
  };

  constructor() {
    this.api.getOffers(this.siteSlug).subscribe((offers) => {
      const bookableOffers = offers.filter(
        (offer) => offer.allowOnlineBooking !== false
      );
      this.offers.set(bookableOffers);
      this.selectedOfferId =
        this.selectedOfferId || bookableOffers[0]?.id || '';
    });
    this.api.getAvailabilities(this.siteSlug).subscribe((availabilities) => {
      const activeAvailabilities = availabilities.filter(
        (entry) => entry.isActive !== false
      );
      this.availabilities.set(activeAvailabilities);
      this.selectedSlotKey =
        this.selectedSlotKey ||
        this.buildAvailableSlots(
          activeAvailabilities,
          this.availabilityOverrides(),
          this.busyWindows()
        )[0]?.key ||
        '';
    });
    this.api.getAvailabilityOverrides(this.siteSlug).subscribe((overrides) => {
      this.availabilityOverrides.set(
        overrides.filter((entry) => entry.isActive !== false)
      );
    });
    this.api.getBusyWindows(this.siteSlug).subscribe((busyWindows) => {
      this.busyWindows.set(busyWindows);
    });

    effect(() => {
      const clientUser = this.auth.clientUser();
      if (!clientUser) {
        return;
      }

      this.form.name =
        this.form.name ||
        clientUser.name ||
        clientUser.email.split('@')[0] ||
        '';
      this.form.email = this.form.email || clientUser.email || '';
    });

    effect(() => {
      const slot = this.selectedSlot();
      if (!slot) {
        return;
      }

      this.form.preferredStart = this.toDateTimeLocal(slot.start);
      this.form.preferredEnd = this.toDateTimeLocal(slot.end);
    });

    effect(() => {
      if (!this.auth.clientUser()) {
        this.isAcceptedClient.set(false);
        return;
      }

      this.api
        .getClientBookingStatus(this.siteSlug)
        .pipe(
          catchError(() => {
            this.isAcceptedClient.set(false);
            this.clientStatus.set(null);
            return EMPTY;
          })
        )
        .subscribe((status) => {
          this.clientStatus.set(status);
          this.isAcceptedClient.set(!!status.accepted);
        });
    });
  }

  submit(): void {
    const clientUser = this.auth.clientUser();
    const acceptedClient = !!clientUser && this.isAcceptedClient();
    const slot = this.selectedSlot();

    if (
      !clientUser &&
      (!this.form.name.trim() ||
        !this.form.email.trim() ||
        !this.form.phone.trim())
    ) {
      this.message.set(
        'Name, email, and phone are required before sending a request.'
      );
      return;
    }

    if (acceptedClient) {
      if (!slot) {
        this.message.set(
          'Choose a published availability window before submitting.'
        );
        return;
      }

      this.api
        .createBooking({
          siteSlug: this.siteSlug ?? undefined,
          title:
            this.selectedOffer()?.label ||
            this.form.goal ||
            this.site().contact.consultationLabel,
          description: this.bookingDescription(),
          startTime: slot.start,
          endTime: slot.end,
          isFreeConsultation: true,
          notes: this.bookingNotes(),
        })
        .pipe(
          catchError((error) => {
            this.message.set(
              error?.error?.message ||
                'We could not submit this booking request.'
            );
            return EMPTY;
          })
        )
        .subscribe(() => {
          this.message.set('Consultation request submitted.');
        });

      return;
    }

    this.api
      .createLeadIntake({
        siteSlug: this.siteSlug ?? undefined,
        name: this.form.name,
        email: this.form.email,
        phone: this.form.phone,
        goal:
          this.form.goal ||
          this.selectedOffer()?.label ||
          this.site().contact.consultationLabel,
        context: this.intakeContext(),
        preferredStart: this.form.preferredStart,
        preferredEnd: this.form.preferredEnd,
        ...(clientUser
          ? {
              userId: clientUser.userId,
              profileId: clientUser.profileId,
            }
          : {}),
      })
      .pipe(
        catchError((error) => {
          this.message.set(
            error?.error?.message || 'We could not submit this request.'
          );
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.message.set(
          clientUser
            ? "Your request is in review. We'll follow up in your client workspace and by email."
            : 'Your request is in review. Create an account now to make scheduling faster.'
        );
      });
  }

  goToRegister(): void {
    void this.router.navigate(['/client/register']);
  }

  private bookingNotes(): string {
    return [
      this.form.name ? `Client: ${this.form.name}` : null,
      this.form.email ? `Email: ${this.form.email}` : null,
      this.form.phone ? `Phone: ${this.form.phone}` : null,
      this.selectedOffer()?.label
        ? `Offer: ${this.selectedOffer()?.label}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private selectedSlot(): BookableSlot | null {
    return (
      this.availableSlots().find((slot) => slot.key === this.selectedSlotKey) ??
      null
    );
  }

  private bookingDescription(): string {
    return [
      this.selectedOffer()?.label
        ? `Requested offer: ${this.selectedOffer()?.label}`
        : null,
      this.form.context || null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private intakeContext(): string {
    return [
      this.selectedOffer()?.label
        ? `Requested offer: ${this.selectedOffer()?.label}`
        : null,
      this.form.context || null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildAvailableSlots(
    availabilities: Availability[],
    availabilityOverrides: AvailabilityOverride[],
    busyWindows: BusinessBusyWindow[]
  ): BookableSlot[] {
    const now = new Date();
    const slots: BookableSlot[] = [];

    for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + dayOffset);

      for (const availability of availabilities) {
        if (availability.dayOfWeek !== date.getDay()) {
          continue;
        }

        const start = this.combineDateAndTime(date, availability.startTime);
        const end = this.combineDateAndTime(date, availability.endTime);
        if (start <= now || end <= start) {
          continue;
        }

        let slotStart = new Date(start);
        while (slotStart.getTime() + 60 * 60 * 1000 <= end.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
          if (
            slotStart > now &&
            !this.isBlockedByOverride(
              slotStart,
              slotEnd,
              availabilityOverrides
            ) &&
            !this.overlapsBusyWindow(slotStart, slotEnd, busyWindows)
          ) {
            slots.push({
              key: `${availability.id}:${slotStart.toISOString()}`,
              availabilityId: availability.id,
              serviceType: availability.serviceType || 'Consultation',
              start: new Date(slotStart),
              end: slotEnd,
              label: `${slotStart.toLocaleDateString()} · ${slotStart.toLocaleTimeString(
                [],
                {
                  hour: 'numeric',
                  minute: '2-digit',
                }
              )} - ${slotEnd.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}`,
            });
          }
          slotStart = slotEnd;
        }
      }
    }

    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private combineDateAndTime(date: Date, time: string): Date {
    const [hours = '0', minutes = '0', seconds = '0'] = time.split(':');
    const value = new Date(date);
    value.setHours(Number(hours), Number(minutes), Number(seconds), 0);
    return value;
  }

  private toDateTimeLocal(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private isBlockedByOverride(
    start: Date,
    end: Date,
    overrides: AvailabilityOverride[]
  ): boolean {
    return overrides.some(
      (override) =>
        override.mode === 'blocked' &&
        this.rangesOverlap(
          start,
          end,
          new Date(override.startTime),
          new Date(override.endTime)
        )
    );
  }

  private overlapsBusyWindow(
    start: Date,
    end: Date,
    busyWindows: BusinessBusyWindow[]
  ): boolean {
    return busyWindows.some((window) =>
      this.rangesOverlap(
        start,
        end,
        new Date(window.startTime),
        new Date(window.endTime)
      )
    );
  }

  private rangesOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date
  ): boolean {
    return (
      startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
    );
  }
}
