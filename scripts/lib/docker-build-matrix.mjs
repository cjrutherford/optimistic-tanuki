export function resolveDockerBuildMatrix({ buildApps = [] } = {}) {
  return {
    include: [...new Set(buildApps)].sort().map((app) => ({ app })),
  };
}
