import { OptomisitcTanukiAPIService } from './generated/payments';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client. Only donations routes have UI callers today; the
 * rest are generated for documentation and future adoption.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
describe('generated payments client operations', () => {
  it('exposes the donations operations', () => {
    for (const method of [
      'paymentsControllerRecordDonation',
      'paymentsControllerCreateDonationCheckout',
      'paymentsControllerGetDonations',
      'paymentsControllerGetUserDonations',
      'paymentsControllerCancelRecurringDonation',
    ] as const) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });

  it('exposes classifieds, business, sponsorship, and offer operations', () => {
    for (const method of [
      'paymentsControllerCreateClassifiedPayment',
      'paymentsControllerDisputePayment',
      'paymentsControllerCreateBusinessCheckout',
      'paymentsControllerCreateSponsorshipCheckout',
      'paymentsControllerCreateOffer',
    ] as const) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
