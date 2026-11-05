import { Observable, of, throwError } from 'rxjs';
import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { LocalitiesService } from './localities';

const common = {
  state: 'GA',
  parents: [] as string[],
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  topics: [],
  sources: [],
};
const county = {
  ...common,
  slug: 'county-ga',
  name: 'County',
  kind: 'county',
  edition: false,
} as unknown as LocalityConfig;
const town = {
  ...common,
  slug: 'town-ga',
  name: 'Town',
  kind: 'town',
  parents: ['county-ga'],
  edition: true,
} as unknown as LocalityConfig;

interface Logs {
  warn: jest.Mock;
  log: jest.Mock;
  error: jest.Mock;
}

class FakeBriefing {
  reply: () => Observable<LocalityConfig[]> = () => of([county, town]);
  readonly sent: string[] = [];
  send<T>(pattern: { cmd: string }): Observable<T> {
    this.sent.push(pattern.cmd);
    return this.reply() as unknown as Observable<T>;
  }
}

function build(briefing: FakeBriefing) {
  const logs: Logs = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
  return { logs, service: new LocalitiesService(briefing, logs) };
}

describe('LocalitiesService', () => {
  it('is empty-safe, and says so, until civic-briefing answers', async () => {
    const briefing = new FakeBriefing();
    briefing.reply = () => throwError(() => new Error('unreachable'));
    const { service, logs } = build(briefing);
    await service.refresh();
    expect(logs.warn).toHaveBeenCalledWith(
      expect.stringMatching(/no localities are loaded/u)
    );
    expect(service.find('town-ga')).toBeUndefined();
    expect(service.editions()).toEqual([]);
    expect(() => service.get('town-ga')).toThrow(/unknown locality/u);
  });

  it('builds the registry from the LIST_LOCALITIES reply', async () => {
    const briefing = new FakeBriefing();
    const { service } = build(briefing);
    await service.refresh();
    expect(briefing.sent).toEqual([CivicBriefingCommands.LIST_LOCALITIES]);
    expect(service.get('town-ga').name).toBe('Town');
    expect(service.find('nowhere')).toBeUndefined();
    expect(service.editions()).toEqual(['town-ga']);
  });

  it('keeps the last good registry when a refresh fails, and picks up new towns when it works', async () => {
    const briefing = new FakeBriefing();
    const { service, logs } = build(briefing);
    await service.refresh();
    briefing.reply = () => throwError(() => new Error('down'));
    await service.refresh();
    expect(service.editions()).toEqual(['town-ga']);
    expect(logs.warn).toHaveBeenCalledWith(
      expect.stringMatching(/keeping the previous 2 localities/u)
    );
    const other = { ...town, slug: 'other-ga', name: 'Other' };
    briefing.reply = () => of([county, town, other]);
    await service.refresh();
    expect(service.editions().sort()).toEqual(['other-ga', 'town-ga']);
  });
});
