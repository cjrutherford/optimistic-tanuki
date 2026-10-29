import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsController } from './classifieds.controller';

describe('ClassifiedsController ownership lookup', () => {
  it('exposes the indexed owner-id command scoped to the requested app', async () => {
    const classifiedsService = {
      findIdsByUser: jest.fn().mockResolvedValue(['classified-1']),
    };
    const controller = new ClassifiedsController(classifiedsService as never);

    await expect(
      controller.findIdsByUser({ userId: 'seller-1', appScope: 'local-hub' })
    ).resolves.toEqual(['classified-1']);
    expect(classifiedsService.findIdsByUser).toHaveBeenCalledWith(
      'seller-1',
      'local-hub'
    );
    expect(ClassifiedCommands.FIND_BY_USER).toBe('classified.findByUser');
  });
});
