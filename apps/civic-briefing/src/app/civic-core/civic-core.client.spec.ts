import { NEVER, of, throwError } from 'rxjs';
import {
  CIVIC_GET_AGENDAS,
  CIVIC_GET_BROADCASTS,
  CIVIC_GET_TENANTS,
  CIVIC_GET_TIP_PROJECTS,
} from '@optimistic-tanuki/constants';
import { TcpCivicCoreClient, civicCoreEndpoint } from './civic-core.client';

describe('TcpCivicCoreClient', () => {
  it('sends each read with its Civic Core message pattern and payload', async () => {
    const send = jest.fn(() => of([{ id: 'x' }]));
    const client = new TcpCivicCoreClient({ send } as never, 1000);
    await client.tenants();
    await client.agendas('t1', { limit: 5 });
    await client.broadcasts('t1', { since: '2026-10-01' });
    await client.tipProjects('t1');
    expect(send.mock.calls).toEqual([
      [CIVIC_GET_TENANTS, {}],
      [CIVIC_GET_AGENDAS, { tenantId: 't1', limit: 5 }],
      [CIVIC_GET_BROADCASTS, { tenantId: 't1', since: '2026-10-01' }],
      [CIVIC_GET_TIP_PROJECTS, { tenantId: 't1' }],
    ]);
  });

  it('returns the reply, or an empty list for a non-array reply', async () => {
    const tenants = [{ id: 'a' }];
    expect(
      await new TcpCivicCoreClient({
        send: () => of(tenants),
      } as never).tenants()
    ).toEqual(tenants);
    expect(
      await new TcpCivicCoreClient({ send: () => of(null) } as never).tenants()
    ).toEqual([]);
  });

  it('rejects when Civic Core fails', async () => {
    const client = new TcpCivicCoreClient({
      send: () => throwError(() => new Error('ECONNREFUSED')),
    } as never);
    await expect(client.tenants()).rejects.toThrow(/ECONNREFUSED/);
  });

  it('rejects when Civic Core does not answer in time', async () => {
    const client = new TcpCivicCoreClient({ send: () => NEVER } as never, 20);
    await expect(client.tenants()).rejects.toThrow();
  });
});

describe('civicCoreEndpoint', () => {
  it('defaults to civic:3026', () => {
    expect(civicCoreEndpoint({})).toEqual({ host: 'civic', port: 3026 });
  });
  it('reads CIVIC_HOST and CIVIC_PORT', () => {
    expect(
      civicCoreEndpoint({ CIVIC_HOST: 'localhost', CIVIC_PORT: '4000' })
    ).toEqual({ host: 'localhost', port: 4000 });
  });
});
