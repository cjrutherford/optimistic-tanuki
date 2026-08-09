import { ClassifiedsService } from './classifieds.service';

describe('ClassifiedsService ownership lookup', () => {
  it('returns only classified ids for the requested owner', async () => {
    const repo = {
      find: jest
        .fn()
        .mockResolvedValue([{ id: 'classified-1' }, { id: 'classified-2' }]),
    };
    const service = new ClassifiedsService(repo as never);

    await expect(service.findIdsByUser('seller-1')).resolves.toEqual([
      'classified-1',
      'classified-2',
    ]);
    expect(repo.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { userId: 'seller-1' },
    });
  });
});
