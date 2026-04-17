import { verifySeeds } from './verify-seeds';

describe('verifySeeds', () => {
  it('accepts db setup and seed success markers', async () => {
    const result = await verifySeeds({
      bootstrapLog: [
        'All databases created',
        'Database setup and migrations complete.',
        'Gateway is ready.',
        'Seeding completed successfully.',
        'Finance seeding completed successfully!',
      ].join('\n'),
      gatewayReady: {
        apiDocsOk: true,
        emptyLoginStatus: 400,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      dbSetupVerified: true,
      gatewayReadyVerified: true,
      permissionsSeedVerified: true,
      financeSeedVerified: true,
      financeEvidenceVerified: false,
      permissionsEvidenceVerified: false,
    });
  });

  it('fails when finance seed evidence is missing', async () => {
    await expect(
      verifySeeds({
        bootstrapLog: [
          'All databases created',
          'Database setup and migrations complete.',
          'Gateway is ready.',
          'Seeding completed successfully.',
        ].join('\n'),
        gatewayReady: {
          apiDocsOk: true,
          emptyLoginStatus: 400,
        },
      })
    ).rejects.toThrow('Missing finance seed success marker');
  });
});
