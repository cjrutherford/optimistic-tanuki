import {
  ClassifiedCommands,
  ClassifiedTelosCommands,
} from '@optimistic-tanuki/constants';
import { ClassifiedsController } from './classifieds.controller';

describe('ClassifiedsController', () => {
  const createController = () => {
    const classifiedsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCommunity: jest.fn(),
      findByProfile: jest.fn(),
      search: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      markSold: jest.fn(),
      feature: jest.fn(),
      unfeature: jest.fn(),
    };
    const classifiedsTelosService = {
      getProfileFacts: jest.fn(),
    };

    const controller = new ClassifiedsController(
      classifiedsService as never,
      classifiedsTelosService as never
    );

    return { controller, classifiedsService, classifiedsTelosService };
  };

  it('delegates TELOS fact retrieval for a profile', async () => {
    const { controller, classifiedsTelosService } = createController();

    await controller.getProfileFacts({ profileId: 'profile-1' });

    expect(classifiedsTelosService.getProfileFacts).toHaveBeenCalledWith(
      'profile-1'
    );
  });
});
