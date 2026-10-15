import { Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { AuthCommands, ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { Inject } from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';

export type GuardianAssetActor = {
  actorUserId: string;
  targetProfileId: string;
  appId: string;
  operation?: 'content.view' | 'content.manage';
};

type ProfileRecord = { id: string; userId: string; appScope?: string | null };
const APP_IDS = new Set(['client-interface', 'local-hub']);

@Injectable()
export class GuardianAssetAuthorizationService {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) private readonly authClient: ClientProxy
  ) {}

  async assertAccess(input: GuardianAssetActor & { operation: 'content.view' | 'content.manage' }): Promise<ProfileRecord> {
    if (
      !input?.actorUserId || !input.targetProfileId ||
      !APP_IDS.has(input.appId) ||
      !['content.view', 'content.manage'].includes(input.operation)
    ) throw this.denied('Invalid guardian asset authorization request');

    const profile = await firstValueFrom(
      this.profileClient.send({ cmd: ProfileCommands.Get }, { id: input.targetProfileId })
        .pipe(timeout({ first: 3000 }))
    ) as ProfileRecord | null;
    if (
      !profile || profile.id !== input.targetProfileId || !profile.userId ||
      profile.appScope !== input.appId || profile.userId === input.actorUserId
    ) throw this.denied('Guardian asset target does not match the verified application');

    try {
      await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.AuthorizeGuardianContentOperation }, {
          actorUserId: input.actorUserId,
          dependentUserId: profile.userId,
          appId: input.appId,
          operation: input.operation,
        }).pipe(timeout({ first: 3000 }))
      );
    } catch (error) {
      const details = error instanceof RpcException ? error.getError() : error;
      if (
        details && typeof details === 'object' && 'statusCode' in details &&
        details.statusCode === 403 && 'code' in details &&
        details.code === 'GUARDIAN_CONTENT_ACCESS_DENIED'
      ) throw this.denied('Guardian asset access denied');
      throw error;
    }
    return profile;
  }

  private denied(message: string): RpcException {
    return new RpcException({
      statusCode: 403,
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
      message,
    });
  }
}
