import { OFFERING_PRESETS } from './presets';

describe('OFFERING_PRESETS', () => {
  it('includes structured marketing objectives for focal portfolio apps', () => {
    const targetedOfferings = [
      'client-interface',
      'local-hub',
      'forgeofwill',
      'fin-commander',
    ];

    for (const offeringId of targetedOfferings) {
      const offering = OFFERING_PRESETS.find(
        (preset) => preset.id === offeringId
      );

      expect(offering).toBeDefined();
      expect(offering?.positioning).toBeTruthy();
      expect(offering?.valueProposition).toBeTruthy();
      expect(offering?.objectives?.length).toBeGreaterThan(1);
      expect(offering?.proofPoints?.length).toBeGreaterThan(1);
      expect(offering?.adArchetypes?.length).toBeGreaterThan(1);
    }
  });

  it('keeps Towne Square as the visible marketing name for local-hub', () => {
    const offering = OFFERING_PRESETS.find(
      (preset) => preset.id === 'local-hub'
    );

    expect(offering?.name).toBe('Towne Square');
    expect(offering?.positioning).toContain('place-based');
  });

  it('includes service and library offerings with delivery and pricing posture', () => {
    const billingService = OFFERING_PRESETS.find(
      (preset) => preset.id === 'billing-service'
    );
    const billingSdk = OFFERING_PRESETS.find(
      (preset) => preset.id === 'billing-sdk'
    );

    expect(billingService).toBeDefined();
    expect(billingService?.deliveryModel).toBe('hybrid');
    expect(billingService?.pricingModel).toBe('metered');
    expect(billingService?.selfHostedNote).toContain('Docker');

    expect(billingSdk).toBeDefined();
    expect(billingSdk?.deliveryModel).toBe('npm-package');
    expect(billingSdk?.pricingModel).toBe('free');
  });
});
