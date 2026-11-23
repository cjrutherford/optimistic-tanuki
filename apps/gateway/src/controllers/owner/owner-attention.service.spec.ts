import { ClientProxy } from '@nestjs/microservices';
import { Observable, NEVER, of, throwError } from 'rxjs';
import {
  AttentionItem,
  OwnerAttentionService,
  SOURCE_TIMEOUT_MS,
} from './owner-attention.service';

interface ClientDouble {
  send: jest.Mock;
}

const TOWN = '11111111-1111-4111-8111-111111111111';

const client = (
  reply: (pattern: { cmd: string }) => Observable<unknown>
): ClientDouble => ({
  send: jest.fn((pattern: { cmd: string }) => reply(pattern)),
});

const asProxy = (c: ClientDouble) => c as unknown as ClientProxy;

describe('OwnerAttentionService', () => {
  const env = { ...process.env };
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...env };
    delete process.env['DIRECTORY_LOCAL_EVALUATION'];
    fetchSpy.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
    process.env = env;
  });

  const build = (overrides: {
    store?: ClientDouble;
    social?: ClientDouble;
    forum?: ClientDouble;
    leads?: ClientDouble;
    civic?: ClientDouble;
  }) =>
    new OwnerAttentionService(
      asProxy(overrides.store ?? client(() => of([]))),
      asProxy(overrides.social ?? client(() => of([]))),
      asProxy(overrides.forum ?? client(() => of([]))),
      asProxy(overrides.leads ?? client(() => of([]))),
      asProxy(overrides.civic ?? client(() => of([])))
    );

  const find = (items: AttentionItem[], source: string) =>
    items.find((item) => item.source === source);

  it('counts open orders and finds the oldest', async () => {
    const store = client((p) =>
      p.cmd === 'findAllOrders'
        ? of([
            { status: 'pending', createdAt: '2026-01-02T00:00:00Z' },
            { status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
            { status: 'completed', createdAt: '2025-01-01T00:00:00Z' },
          ])
        : of([])
    );
    const report = await build({ store }).collect({ profileId: 'p' });
    const orders = find(report.items, 'commerce.orders');
    expect(orders).toMatchObject({
      status: 'ok',
      count: 2,
      oldest: '2026-01-01T00:00:00.000Z',
      link: '/dashboard/store/orders',
    });
  });

  it('reports a failing source as unavailable with null count, not zero', async () => {
    const store = client(() => throwError(() => new Error('secret://dsn')));
    const report = await build({ store }).collect({ profileId: 'p' });
    const orders = find(report.items, 'commerce.orders');
    expect(orders).toMatchObject({
      status: 'unavailable',
      count: null,
      oldest: null,
    });
    expect(orders?.error).toBe('Service unreachable');
    expect(JSON.stringify(report)).not.toContain('secret://');
    // The other sources still answered.
    expect(find(report.items, 'moderation.forum')?.status).toBe('ok');
  });

  it('times a hung source out after the deadline', async () => {
    const leads = client(() => NEVER);
    const pending = build({ leads }).collect({ profileId: 'p' });
    await jest.advanceTimersByTimeAsync(SOURCE_TIMEOUT_MS + 100);
    const report = await pending;
    expect(find(report.items, 'leads.new')).toMatchObject({
      status: 'unavailable',
      count: null,
      error: 'Timed out after 3s',
    });
  });

  it('reports leads unavailable when the session has no profile', async () => {
    const report = await build({}).collect({});
    expect(find(report.items, 'leads.new')).toMatchObject({
      status: 'unavailable',
      count: null,
    });
  });

  it('marks every directory queue unavailable when Directory is not configured', async () => {
    const report = await build({}).collect({ profileId: 'p' });
    const queues = report.items.filter((i) =>
      i.source.startsWith('directory.')
    );
    expect(queues.length).toBeGreaterThanOrEqual(6);
    for (const item of queues) {
      expect(item).toMatchObject({ status: 'unavailable', count: null });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads a town queue and skips towns with nothing waiting', async () => {
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
    process.env['DIRECTORY_INTERNAL_URL'] = 'http://directory:3120';
    process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'] = 'x'.repeat(40);
    process.env['DIRECTORY_BUSINESS_LINK_SECRET'] = 'y'.repeat(40);
    const social = client((p) =>
      p.cmd === 'LIST_LOCALITY_COMMUNITIES'
        ? of([{ id: TOWN, name: 'Springfield' }, { id: 'not-a-uuid' }])
        : of([])
    );
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('duplicate-cases')
        ? { cases: [{ createdAt: '2026-03-01T00:00:00Z' }], total: 7 }
        : url.includes('listing-reports')
        ? { reports: [] }
        : url.includes('address-review')
        ? { error: true }
        : { candidates: [], requests: [], suppressions: [], health: null };
      return new Response(JSON.stringify(body), {
        status: url.includes('address-review') ? 500 : 200,
      });
    });
    const report = await build({ social }).collect({ profileId: 'p' });
    const duplicates = report.items.filter(
      (i) => i.source === 'directory.duplicates'
    );
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({
      count: 7,
      townId: TOWN,
      link: `/dashboard/towns/${TOWN}/directory-duplicates`,
    });
    // Empty queues add no row; a failing one does.
    expect(report.items.some((i) => i.source === 'directory.reports')).toBe(
      false
    );
    const address = find(report.items, 'directory.address');
    expect(address).toMatchObject({ status: 'unavailable', count: null });
    expect(address?.error).toBe('Directory answered 500');
    // The identity queue got a malformed reply: unavailable, not zero.
    expect(find(report.items, 'directory.identity')?.status).toBe(
      'unavailable'
    );
  });

  it('counts suspended reviewed bindings from the list total, and never reports zero for a bad reply', async () => {
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
    process.env['DIRECTORY_INTERNAL_URL'] = 'http://directory:3120';
    process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'] = 'x'.repeat(40);
    process.env['DIRECTORY_BUSINESS_LINK_SECRET'] = 'y'.repeat(40);
    let reply: unknown = { bindings: [], total: 4, nextCursor: null };
    fetchSpy.mockImplementation(async (input) =>
      String(input).includes('reviewed-bindings')
        ? new Response(JSON.stringify(reply), { status: 200 })
        : new Response(JSON.stringify({}), { status: 200 })
    );
    let report = await build({}).collect({ profileId: 'p' });
    expect(find(report.items, 'directory.suspendedBindings')).toMatchObject({
      status: 'ok',
      count: 4,
      link: '/dashboard/directory-suspended-bindings',
    });
    expect(String(fetchSpy.mock.calls.map((c) => c[0]))).toContain(
      '/internal/reviewed-bindings?state=suspended&limit=1'
    );
    reply = { bindings: [] };
    report = await build({}).collect({ profileId: 'p' });
    expect(find(report.items, 'directory.suspendedBindings')).toMatchObject({
      status: 'unavailable',
      count: null,
    });
  });
});
