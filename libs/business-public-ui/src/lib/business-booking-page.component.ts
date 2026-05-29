import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BusinessOffer,
  BusinessApiService,
  BusinessAuthService,
  BusinessBusyWindow,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import {
  Availability,
  AvailabilityOverride,
} from '@optimistic-tanuki/ui-models';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

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
        <h1>{{ site().contact.consultationLabel }}</h1>
        <p>
          Tell us what you need, what kind of support would help, and when you
          would like to get started. We review every request before confirming
          any schedule.
        </p>
        <p class="support-copy">
          Choose any published one-hour time block first, then optionally pair
          it with the offer that fits your goals.
        </p>
        <p class="support-copy">
          Create an account to track your request, schedule sessions faster, and
          access your client workspace.
        </p>
        <a class="cta-link" [routerLink]="['/client/register']"
          >Create account</a
        >
      </div>

      <otui-card>
        <form class="form" (ngSubmit)="submit()">
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
            Requested offer
            <select [(ngModel)]="selectedOfferId" name="selectedOfferId">
              <option value="">Choose an offer later</option>
              @for (offer of offers(); track offer.id) {
              <option [value]="offer.id">{{ offer.label }}</option>
              }
            </select>
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
          <label>
            Primary goal
            <input [(ngModel)]="form.goal" name="goal" />
          </label>
          @if (!availableSlots().length) {
          <p class="message">
            Booking opens when the owner publishes availability. You can still
            submit a request for follow-up.
          </p>
          }
          <label>
            Context
            <textarea [(ngModel)]="form.context" name="context"></textarea>
          </label>
          <otui-button type="submit" variant="primary"
            >Send request</otui-button
          >
          @if (message()) {
          <p class="message">{{ message() }}</p>
          }
        </form>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
        gap: 1rem;
      }
      .copy {
        display: grid;
        gap: 1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1.5rem);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
        padding: var(--personality-card-padding, 1.5rem);
        box-shadow: var(
          --personality-card-shadow,
          0 18px 44px rgba(15, 23, 42, 0.06)
        );
      }
      .form {
        display: grid;
        gap: 0.85rem;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary, #1f7a63);
      }
      .support-copy,
      .message {
        margin: 0;
        color: var(--primary, #1f7a63);
      }
      .cta-link {
        width: fit-content;
        color: var(--primary, #1f7a63);
        font-weight: 700;
      }
      h1 {
        margin: 0;
        font-family: var(
          --font-heading,
          'Source Sans Pro',
          system-ui,
          sans-serif
        );
        font-size: clamp(2.4rem, 5vw, 4rem);
        font-weight: 700;
        line-height: 0.98;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 700;
      }
      input,
      textarea,
      select {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: var(--personality-input-border-width, 1px) solid var(--border);
        background: rgba(255, 255, 255, 0.8);
        color: inherit;
      }
      textarea {
        min-height: 120px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessBookingPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly router = inject(Router);

  readonly site = computed(() => this.siteConfig.site());
  readonly message = signal('');
  readonly isClientAuthenticated = this.auth.isClientAuthenticated;
  readonly isAcceptedClient = signal(false);
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
    this.api.getOffers().subscribe((offers) => {
      const bookableOffers = offers.filter(
        (offer) => offer.allowOnlineBooking !== false
      );
      this.offers.set(bookableOffers);
      this.selectedOfferId =
        this.selectedOfferId || bookableOffers[0]?.id || '';
    });
    this.api.getAvailabilities().subscribe((availabilities) => {
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
    this.api.getAvailabilityOverrides().subscribe((overrides) => {
      this.availabilityOverrides.set(
        overrides.filter((entry) => entry.isActive !== false)
      );
    });
    this.api.getBusyWindows().subscribe((busyWindows) => {
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
        .getClientBookingStatus()
        .pipe(
          catchError(() => {
            this.isAcceptedClient.set(false);
            return EMPTY;
          })
        )
        .subscribe((status) => {
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
