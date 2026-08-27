import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsController } from './classifieds.controller';

describe('ClassifiedsController ownership lookup', () => {
  it('exposes the indexed owner-id command', async () => {
    const classifiedsService = {
      findIdsByUser: jest.fn().mockResolvedValue(['classified-1']),
    };
    const controller = new ClassifiedsController(classifiedsService as never);

    await expect(
      controller.findIdsByUser({ userId: 'seller-1' })
    ).resolves.toEqual(['classified-1']);
    expect(classifiedsService.findIdsByUser).toHaveBeenCalledWith('seller-1');
    expect(ClassifiedCommands.FIND_BY_USER).toBe('classified.findByUser');
  });
});
