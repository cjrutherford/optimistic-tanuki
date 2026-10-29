import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpException,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Controller('authentication/account-deletion')
export class AccountDeletionHttpController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy
  ) {}

  @Post('prepare')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'private, no-store')
  async prepare(
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Body() body: unknown
  ) {
    const prior =
      !!body &&
      typeof body === 'object' &&
      Object.prototype.hasOwnProperty.call(body, 'priorReceipt');
    const input = this.body(
      body,
      prior
        ? ['accountId', 'idempotencyKey', 'priorReceipt']
        : ['accountId', 'idempotencyKey']
    );
    if (
      typeof input['idempotencyKey'] !== 'string' ||
      !UUID.test(input['idempotencyKey'])
    )
      throw new BadRequestException('Invalid deletion request');
    const value = await this.rpc(AuthCommands.PreparePublicAccountDeletion, {
      ...this.session(user, req, input['accountId']),
      idempotencyKey: input['idempotencyKey'],
      ...(prior
        ? {
            priorReceipt: this.receipt(input['priorReceipt'], user.appId)
              .receipt,
          }
        : {}),
    });
    if (
      typeof value?.['receipt'] !== 'string' ||
      value['receipt'].length > 2048 ||
      !/^[-A-Za-z0-9_]+\.[0-9a-f]{64}$/.test(value['receipt'])
    )
      throw new BadGatewayException('Deletion receipt unavailable');
    return { receipt: value['receipt'] };
  }

  @Post('accept')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'private, no-store')
  async accept(
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Body() body: unknown
  ) {
    const input = this.body(body, ['accountId', 'receipt', 'confirmation']);
    if (input['confirmation'] !== 'delete-account')
      throw new BadRequestException('Explicit deletion confirmation required');
    const context = this.session(user, req, input['accountId']);
    const { receipt } = this.receipt(input['receipt'], context.appId);
    return this.status(
      await this.rpc(AuthCommands.AcceptPublicAccountDeletion, {
        ...context,
        receipt,
        confirmation: 'delete-account',
      }),
      context.appId
    );
  }

  // Normal sessions are revoked at acceptance. Only the separate receipt authorizes these two routes.
  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  async read(
    @Headers('x-ot-deletion-receipt') receipt: unknown,
    @AppScope() appId: unknown
  ) {
    const input = this.receipt(receipt, appId);
    return this.status(
      await this.rpc(AuthCommands.ReadPublicAccountDeletion, input),
      input.appId
    );
  }

  @Post('retry')
  @Header('Cache-Control', 'private, no-store')
  async retry(
    @Headers('x-ot-deletion-receipt') receipt: unknown,
    @AppScope() appId: unknown,
    @Body() body: unknown
  ) {
    this.body(body, []);
    const input = this.receipt(receipt, appId);
    return this.status(
      await this.rpc(AuthCommands.RetryPublicAccountDeletion, input),
      input.appId
    );
  }

  private body(value: unknown, keys: string[]): Record<string, unknown> {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
    )
      throw new BadRequestException('Invalid deletion request');
    return value as Record<string, unknown>;
  }
  private session(
    user: UserDetails,
    req: Request & { credential?: string },
    expected: unknown
  ) {
    if (
      !user ||
      !req.credential ||
      !['client-interface', 'local-hub'].includes(user.appId ?? '')
    )
      throw new ForbiddenException('Account deletion unavailable');
    if (typeof expected !== 'string' || !UUID.test(expected))
      throw new BadRequestException('Invalid account confirmation');
    if (expected.toLowerCase() !== user.userId.toLowerCase())
      throw new ConflictException(
        'Your signed-in account changed. Refresh before continuing.'
      );
    return { token: req.credential, appId: user.appId! };
  }
  private receipt(
    receipt: unknown,
    appId: unknown
  ): { receipt: string; appId: string } {
    if (
      typeof appId !== 'string' ||
      !['client-interface', 'local-hub'].includes(appId) ||
      typeof receipt !== 'string' ||
      receipt.length > 2048 ||
      !/^[-A-Za-z0-9_]+\.[0-9a-f]{64}$/.test(receipt)
    )
      throw new BadRequestException('Deletion receipt required');
    return { receipt, appId };
  }
  private status(value: Record<string, unknown>, appId: string) {
    if (
      !value ||
      value['appId'] !== appId ||
      typeof value['operationId'] !== 'string' ||
      !UUID.test(value['operationId']) ||
      !['not-accepted', 'fencing', 'deleting', 'blocked', 'complete'].includes(
        String(value['state'])
      ) ||
      value['canRetry'] !== (value['state'] === 'blocked') ||
      typeof value['expiresAt'] !== 'string' ||
      !Number.isFinite(Date.parse(value['expiresAt']))
    )
      throw new BadGatewayException('Deletion status unavailable');
    return {
      operationId: value['operationId'],
      appId,
      state: value['state'],
      canRetry: value['canRetry'],
      expiresAt: value['expiresAt'],
    };
  }
  private async rpc(
    cmd: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      return await firstValueFrom(
        this.auth.send({ cmd }, payload).pipe(timeout(15000))
      );
    } catch (error) {
      const status = Number((error as { statusCode?: unknown })?.statusCode);
      throw new HttpException(
        status === 401
          ? 'Your receipt or session is unavailable.'
          : status === 409
          ? 'The request or signed-in account changed.'
          : 'Account deletion is unavailable. Try again.',
        [400, 401, 403, 404, 409, 429, 503].includes(status) ? status : 502
      );
    }
  }
}
