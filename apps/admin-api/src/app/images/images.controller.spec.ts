import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

describe('ImagesController', () => {
  let imagesService: jest.Mocked<
    Pick<ImagesService, 'getImages' | 'refreshImages'>
  >;
  let controller: ImagesController;

  beforeEach(() => {
    imagesService = {
      getImages: jest.fn(),
      refreshImages: jest.fn(),
    } as any;
    controller = new ImagesController(imagesService as any);
  });

  it('getImages delegates to the service', () => {
    imagesService.getImages.mockReturnValue([{ serviceId: 'a' } as any]);
    expect(controller.getImages()).toEqual([{ serviceId: 'a' }]);
  });

  it('refreshImages delegates to the service', () => {
    imagesService.refreshImages.mockReturnValue([{ serviceId: 'b' } as any]);
    expect(controller.refreshImages()).toEqual([{ serviceId: 'b' }]);
  });

  it('rollout returns a success payload including the tag', async () => {
    await expect(controller.rollout('v5')).resolves.toEqual({
      success: true,
      message: 'Rollout triggered with tag v5',
    });
  });
});
