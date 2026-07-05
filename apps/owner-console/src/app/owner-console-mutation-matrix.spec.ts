import { appRoutes } from './app.routes';
import { OWNER_CONSOLE_MUTATION_MATRIX } from './owner-console-mutation-matrix';

describe('OWNER_CONSOLE_MUTATION_MATRIX', () => {
  const dashboardRoute = appRoutes.find((route) => route.path === 'dashboard');
  const dashboardChildPaths = (dashboardRoute?.children ?? []).map(
    (route) => route.path ?? ''
  );

  it('covers all operator workspaces with explicit statuses', () => {
    expect(
      new Set(OWNER_CONSOLE_MUTATION_MATRIX.map((entry) => entry.workspace))
    ).toEqual(
      new Set(['Governance', 'Experience', 'Commerce', 'CRM', 'Community Ops'])
    );

    expect(
      OWNER_CONSOLE_MUTATION_MATRIX.every((entry) =>
        ['complete', 'partial', 'missing'].includes(entry.status)
      )
    ).toBe(true);
  });

  it('maps complete rows to real owner-console routes', () => {
    const completeRoutes = OWNER_CONSOLE_MUTATION_MATRIX.filter(
      (entry) => entry.status === 'complete'
    ).map((entry) => entry.uiRoute.replace('/dashboard/', '').split('/:')[0]);

    completeRoutes.forEach((routePrefix) => {
      expect(
        dashboardChildPaths.some(
          (childPath) =>
            routePrefix === childPath ||
            routePrefix.startsWith(`${childPath}/`) ||
            childPath.startsWith(`${routePrefix}/`)
        )
      ).toBe(true);
    });
  });

  it('documents the remaining partial and missing gaps explicitly', () => {
    expect(
      OWNER_CONSOLE_MUTATION_MATRIX.filter(
        (entry) => entry.status === 'partial'
      )
    ).toHaveLength(0);

    expect(
      OWNER_CONSOLE_MUTATION_MATRIX.filter(
        (entry) => entry.status === 'missing'
      )
    ).toHaveLength(0);
  });

  it('captures crm mutation coverage with explicit lead interventions', () => {
    const crmFeatures = OWNER_CONSOLE_MUTATION_MATRIX.filter(
      (entry) => entry.workspace === 'CRM'
    ).map((entry) => entry.feature);

    expect(new Set(crmFeatures)).toEqual(
      new Set(['Lead update', 'Lead response'])
    );
  });

  it('breaks community moderation into concrete mutation rows', () => {
    const communityFeatures = OWNER_CONSOLE_MUTATION_MATRIX.filter(
      (entry) => entry.workspace === 'Community Ops'
    ).map((entry) => entry.feature);

    expect(communityFeatures).toEqual(
      expect.arrayContaining([
        'Social report update',
        'Social content moderation',
        'Forum topic update',
        'Forum thread update',
        'Forum report update',
        'Forum thread moderation',
        'Forum post moderation',
      ])
    );
  });
});
