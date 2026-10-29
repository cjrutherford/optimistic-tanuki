import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { of, throwError } from 'rxjs';
import { GuardianAssetController } from './guardian-asset.controller';
import { AssetType } from '@optimistic-tanuki/models';
import { AssetCommands } from '@optimistic-tanuki/constants';

describe('GuardianAssetController', () => {
  const actor = { userId: 'guardian-user', appId: 'client-interface' } as any;
  const profile = {
    id: 'dependent-profile',
    userId: 'dependent-user',
    appScope: 'client-interface',
  };

  function createController(
    assetReply: () => any = () => of({ id: 'asset-id' }),
    profileReply = profile
  ) {
    const assets = { send: jest.fn(assetReply) } as any;
    const profiles = { send: jest.fn(() => of(profileReply)) } as any;
    const authentication = {
      send: jest.fn(() => of({ allowed: true })),
    } as any;
    return {
      controller: new GuardianAssetController(assets, profiles, authentication),
      assets,
    };
  }

  it('rejects missing bytes and forged actor/profile/audience fields before asset RPC', async () => {
    const { controller, assets } = createController();
    await expect(
      controller.upload(
        'dependent-profile',
        { name: 'photo.png', type: 'image' } as any,
        actor
      )
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      controller.upload(
        'dependent-profile',
        {
          name: 'photo.png',
          type: 'image',
          content: 'aGVsbG8=',
          actorUserId: 'forged',
          profileId: 'other-profile',
          audienceRestrictions: [],
        } as any,
        actor
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(assets.send).not.toHaveBeenCalled();
  });

  it('validates guardian profile and asset UUID path parameters before any RPC', async () => {
    const { controller, assets } = createController();
    const paths = [
      { method: 'upload', index: 0, name: 'profileId' },
      { method: 'list', index: 0, name: 'profileId' },
      { method: 'remove', index: 0, name: 'profileId' },
      { method: 'remove', index: 1, name: 'assetId' },
    ];
    const validId = 'd5a7d0e3-a183-46bc-92e5-57cc84d9c534';

    for (const { method, index, name } of paths) {
      const args = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        GuardianAssetController,
        method
      );
      const parameter = Object.values(args).find(
        (value: any) => value.index === index
      ) as { pipes: unknown[] };
      const pipe = parameter.pipes.find(
        (value): value is ParseUUIDPipe => value instanceof ParseUUIDPipe
      );

      expect(pipe).toBeInstanceOf(ParseUUIDPipe);
      await expect(
        pipe!.transform('malformed%2F..', { type: 'param', data: name })
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pipe!.transform(validId, { type: 'param', data: name })
      ).resolves.toBe(validId);
    }

    expect(controller).toBeDefined();
    expect(assets.send).not.toHaveBeenCalled();
  });

  it('accepts the real guardian upload body DTO and derives the stored profile from the path', async () => {
    const profileId = 'd5a7d0e3-a183-46bc-92e5-57cc84d9c534';
    const { controller, assets } = createController(undefined, {
      id: profileId,
      userId: 'dependent-user',
      appScope: 'client-interface',
    });
    const parameterTypes = Reflect.getMetadata(
      'design:paramtypes',
      GuardianAssetController.prototype,
      'upload'
    );
    const validation = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const context = {
      type: 'body' as const,
      metatype: parameterTypes[1],
      data: '',
    };
    const body = await validation.transform(
      {
        name: 'photo.png',
        type: AssetType.IMAGE,
        content: 'aGVsbG8=',
        fileExtension: 'png',
      },
      context
    );

    await controller.upload(profileId, body, actor, 'client-interface');

    expect(assets.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.GUARDIAN_CREATE },
      expect.objectContaining({
        actorUserId: 'guardian-user',
        targetProfileId: profileId,
        appId: 'client-interface',
        asset: expect.objectContaining({ profileId }),
      })
    );
  });

  it.each([
    { id: 'd5a7d0e3-a183-46bc-92e5-57cc84d9c534' },
    { profileId: 'd5a7d0e3-a183-46bc-92e5-57cc84d9c534' },
    { actorUserId: 'forged-user' },
    { appId: 'forged-app' },
    { sourcePath: '/etc/passwd' },
  ])('rejects trusted field injection in the upload DTO: %p', async (extra) => {
    const parameterTypes = Reflect.getMetadata(
      'design:paramtypes',
      GuardianAssetController.prototype,
      'upload'
    );
    const validation = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      validation.transform(
        {
          name: 'photo.png',
          type: AssetType.IMAGE,
          content: 'aGVsbG8=',
          ...extra,
        },
        { type: 'body', metatype: parameterTypes[1], data: '' }
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('maps only an exact downstream guardian 403 to forbidden', async () => {
    const denied = createController(() =>
      throwError(() => ({
        statusCode: 403,
        code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
      }))
    );
    await expect(
      denied.controller.list('dependent-profile', undefined, actor)
    ).rejects.toBeInstanceOf(ForbiddenException);

    const unknown = createController(() =>
      throwError(() => ({ statusCode: 403, code: 'OTHER_DENIAL' }))
    );
    await expect(
      unknown.controller.list('dependent-profile', undefined, actor)
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('does not promote unknown downstream service failures into authorization denials', async () => {
    const { controller } = createController(() =>
      throwError(() => new Error('connection reset'))
    );
    let failure: unknown;
    try {
      await controller.list('dependent-profile', undefined, actor);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(502);
  });
});
