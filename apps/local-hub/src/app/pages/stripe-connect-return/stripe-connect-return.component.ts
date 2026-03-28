import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MessageService } from '@optimistic-tanuki/message-ui';

import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-stripe-connect-return',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="stripe-connect-return">
      <div class="panel">
        <span class="eyebrow">Stripe Connect</span>
        <h1>{{ heading() }}</h1>
        <p>{{ detail() }}</p>
        @if (error()) {
        <p class="error-copy">{{ error() }}</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .stripe-connect-return {
        min-height: 60vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        background:
          radial-gradient(circle at top, rgba(30, 64, 175, 0.12), transparent 40%),
          linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      }

      .panel {
        width: min(34rem, 100%);
        padding: 2rem;
        border-radius: 1.5rem;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
        border: 1px solid rgba(148, 163, 184, 0.2);
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 0.75rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #1d4ed8;
      }

      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(1.75rem, 3vw, 2.4rem);
        line-height: 1.1;
        color: #0f172a;
      }

      p {
        margin: 0;
        color: #334155;
        line-height: 1.6;
      }

      .error-copy {
        margin-top: 1rem;
        color: #b91c1c;
      }
    `,
  ],
})
export class StripeConnectReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);

  readonly heading = signal('Finishing Stripe setup');
  readonly detail = signal('Refreshing your seller payout status now.');
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const action = this.route.snapshot.paramMap.get('action');

    if (action === 'refresh') {
      await this.restartOnboarding();
      return;
    }

    await this.completeOnboarding();
  }

  private async completeOnboarding(): Promise<void> {
    this.heading.set('Confirming your Stripe account');
    this.detail.set('Checking whether Stripe has finished enabling payouts.');

    try {
      const wallet = await this.paymentService.refreshSellerStripeConnectStatus();
      if (wallet.stripeAccountStatus === 'enabled') {
        this.messageService.addMessage({
          content: 'Stripe account connected. Future classifieds releases can pay out automatically.',
          type: 'success',
        });
      } else {
        this.messageService.addMessage({
          content: 'Stripe setup is saved, but Stripe still needs more information before payouts are enabled.',
          type: 'warning',
        });
      }

      await this.router.navigate(['/seller-dashboard']);
    } catch (err: any) {
      this.error.set(err?.message || 'Unable to refresh Stripe status.');
      this.messageService.addMessage({
        content: 'Unable to refresh Stripe status right now. You can try again from the seller dashboard.',
        type: 'error',
      });
      await this.router.navigate(['/seller-dashboard']);
    }
  }

  private async restartOnboarding(): Promise<void> {
    this.heading.set('Refreshing your Stripe onboarding link');
    this.detail.set('Generating a fresh Stripe session for seller payouts.');

    try {
      const onboarding = await this.paymentService.createSellerStripeConnectOnboardingLink();
      window.location.assign(onboarding.onboardingUrl);
    } catch (err: any) {
      this.error.set(err?.message || 'Unable to create a new Stripe onboarding session.');
      this.messageService.addMessage({
        content: 'Unable to restart Stripe setup right now. Please try again from the seller dashboard.',
        type: 'error',
      });
      await this.router.navigate(['/seller-dashboard']);
    }
  }
}