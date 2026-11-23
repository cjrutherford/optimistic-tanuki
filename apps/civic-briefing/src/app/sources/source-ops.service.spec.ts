import { sourceStatus } from './source-ops.service';

describe('sourceStatus', () => {
  it.each([
    [{ enabled: false, status: 'failing' }, 'retired'],
    [{ enabled: true, status: 'failing' }, 'failing'],
    [{ enabled: true, status: 'fresh' }, 'healthy'],
    [{ enabled: true, status: 'stale' }, 'quiet'],
    [{ enabled: true, status: 'never-fetched' }, 'quiet'],
  ] as const)('reads %j as %s', (health, expected) => {
    expect(sourceStatus(health)).toBe(expected);
  });
});
