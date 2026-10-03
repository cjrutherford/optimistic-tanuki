import { CivicTenantsService } from './civic-tenants.service';

function service() {
  const saved: unknown[] = [];
  const repository = {
    find: jest.fn(async () => saved),
    save: jest.fn(async (row: unknown) => {
      saved.push(row);
      return row;
    }),
  };
  const dataSource = { getRepository: () => repository };
  return { tenants: new CivicTenantsService(dataSource as never), repository };
}

describe('CivicTenantsService', () => {
  it('registers a tenant with a normalised state and its town', async () => {
    const { tenants, repository } = service();
    await tenants.register({
      id: ' tifton-ga ',
      displayName: '',
      townName: ' Tifton ',
      state: 'ga',
      kind: 'city',
    });
    expect(repository.save).toHaveBeenCalledWith({
      id: 'tifton-ga',
      displayName: 'Tifton',
      townName: 'Tifton',
      state: 'GA',
      kind: 'city',
    });
  });

  it.each([
    [{ state: 'Georgia' }, /two-letter/],
    [{ kind: 'borough' }, /kind must be/],
    [{ townName: ' ' }, /townName is required/],
    [{ id: '' }, /tenant id is required/],
  ])('refuses an invalid tenant (%o)', async (override, message) => {
    const { tenants } = service();
    await expect(
      tenants.register({
        id: 'x',
        displayName: 'X',
        townName: 'X',
        state: 'GA',
        kind: 'city',
        ...(override as object),
      } as never)
    ).rejects.toThrow(message);
  });

  it('lists tenants in id order', async () => {
    const { tenants, repository } = service();
    await tenants.list();
    expect(repository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
  });
});
