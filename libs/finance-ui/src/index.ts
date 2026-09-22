export * from './lib/finance-ui/finance-ui.component';
export * from './lib/finance-ui/finance.routes';
export * from './lib/finance-ui/tokens/finance-host-config.token';
// Promoted to `@optimistic-tanuki/finance-data-access` per T3 (single source).
// This re-export is back-compat; new code imports from `finance-data-access`.
export * from '@optimistic-tanuki/finance-data-access';
