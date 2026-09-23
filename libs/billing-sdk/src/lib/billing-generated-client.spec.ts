import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the committed orval output without importing Angular at runtime
 * (this lib's jest preset is plain node; importing the generated service
 * would pull @angular/common/http ESM). Fails if the tag filter stops
 * working — either by dropping a billing op or by leaking other routes in.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
describe('generated billing client output', () => {
  const source = readFileSync(
    join(__dirname, '..', 'generated', 'billing.ts'),
    'utf8'
  );

  it('exposes record, batch, and preview operations', () => {
    for (const method of [
      'billingControllerRecordUsage',
      'billingControllerBatchRecordUsage',
      'billingControllerPreviewInvoice',
    ]) {
      expect(source).toContain(method);
    }
  });

  it('contains only the three billing routes', () => {
    const routes = Array.from(
      source.matchAll(/`(\/api\/[^`]+)`/g),
      (match) => match[1]
    );
    expect([...new Set(routes)].sort()).toEqual([
      '/api/billing/invoices/preview',
      '/api/billing/usage/batch',
      '/api/billing/usage/record',
    ]);
  });
});
