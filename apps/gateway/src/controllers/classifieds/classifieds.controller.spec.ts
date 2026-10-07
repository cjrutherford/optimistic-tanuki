import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsController } from './classifieds.controller';

const seller = {
  userId: 'seller-user',
  profileId: 'seller-profile',
} as any;

function makeController() {
  const classifiedsClient = {
    send: jest.fn().mockReturnValue(of({ id: 'ad-1' })),
  };
  const socialClient = {
    send: jest.fn().mockReturnValue(of({ id: 'community-1' })),
  };
  return {
    controller: new ClassifiedsController(
      classifiedsClient as any,
      socialClient as any
    ),
    classifiedsClient,
    socialClient,
  };
}

describe('ClassifiedsController scope and RPC boundary', () => {
  it('binds create identity and app scope from the authenticated request', async () => {
    const { controller, classifiedsClient } = makeController();
    await controller.create(
      seller,
      {
        communityId: 'community-1',
        title: 'Lamp',
        description: 'Brass',
        price: 20,
      },
      'local-hub'
    );

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.CREATE },
      expect.objectContaining({
        profileId: 'seller-profile',
        userId: 'seller-user',
        appScope: 'local-hub',
      })
    );
  });

  it('resolves a create slug and removes the transport-only slug before the owning RPC', async () => {
    const { controller, classifiedsClient, socialClient } = makeController();
    socialClient.send.mockReturnValue(of({ id: 'community-from-slug' }));

    await controller.create(
      seller,
      {
        communitySlug: 'market',
        title: 'Lamp',
        description: 'Brass',
        price: 20,
      },
      'local-hub'
    );

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.CREATE },
      {
        dto: {
          title: 'Lamp',
          description: 'Brass',
          price: 20,
          communityId: 'community-from-slug',
        },
        profileId: 'seller-profile',
        userId: 'seller-user',
        appScope: 'local-hub',
      }
    );
  });

  it('requires app scope before public or mutation RPCs', async () => {
    const { controller, classifiedsClient } = makeController();
    await expect(
      controller.findById('ad-1', null as never, null)
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(classifiedsClient.send).not.toHaveBeenCalled();
  });

  it('passes a verified optional user to private listing read authorization', async () => {
    const { controller, classifiedsClient } = makeController();
    await controller.findById('ad-1', 'local-hub', {
      userId: 'member-user',
    } as any);

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.FIND_BY_ID },
      { id: 'ad-1', appScope: 'local-hub', requestingUserId: 'member-user' }
    );
  });

  it('returns the explicit removal result instead of awaiting an empty RPC stream', async () => {
    const { controller, classifiedsClient } = makeController();
    classifiedsClient.send.mockReturnValue(
      of({ id: 'ad-1', status: 'removed' })
    );

    await expect(
      controller.remove(seller, 'ad-1', 'local-hub')
    ).resolves.toEqual({
      id: 'ad-1',
      status: 'removed',
    });
  });

  it('translates structured owner denials to an HTTP 403', async () => {
    const { controller, classifiedsClient } = makeController();
    classifiedsClient.send.mockReturnValue(
      throwError(
        () => new RpcException({ statusCode: 403, message: 'Not the owner' })
      )
    );

    await expect(
      controller.remove(seller, 'ad-1', 'local-hub')
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });
});
