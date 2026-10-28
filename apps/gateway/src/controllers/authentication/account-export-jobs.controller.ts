import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpException,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import type { AccountExportJobStatus } from '@optimistic-tanuki/models';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Browser-facing job controls. Session/account authority stays in Authentication. */
@Controller('authentication/account-export')
@UseGuards(AuthGuard)
export class AccountExportJobsController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Body() body: unknown
  ) {
    const input = this.body(body, ['accountId', 'idempotencyKey']);
    if (
      typeof input['idempotencyKey'] !== 'string' ||
      !UUID.test(input['idempotencyKey'])
    )
      throw new BadRequestException('Invalid export request');
    return this.run(AuthCommands.CreateAccountExportJob, {
      ...this.context(user, req, input['accountId']),
      idempotencyKey: input['idempotencyKey'],
    });
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async latest(
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Query('accountId') expected: unknown
  ) {
    return {
      job: await this.run(
        AuthCommands.GetLatestAccountExportJob,
        this.context(user, req, expected),
        true
      ),
    };
  }

  @Get(':jobId')
  @Header('Cache-Control', 'private, no-store')
  get(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Query('accountId') expected: unknown
  ) {
    return this.run(AuthCommands.GetAccountExportJob, {
      ...this.context(user, req, expected),
      jobId,
    });
  }

  @Post(':jobId/retry')
  @Header('Cache-Control', 'private, no-store')
  retry(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Body() body: unknown
  ) {
    const input = this.body(body, ['accountId']);
    return this.run(AuthCommands.ResumeAccountExportJob, {
      ...this.context(user, req, input['accountId']),
      jobId,
    });
  }

  @Post(':jobId/cancel')
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @User() user: UserDetails,
    @Req() req: Request & { credential?: string },
    @Body() body: unknown
  ) {
    const input = this.body(body, ['accountId']);
    return this.run(AuthCommands.CancelAccountExportJob, {
      ...this.context(user, req, input['accountId']),
      jobId,
    });
  }

  private body(value: unknown, keys: string[]): Record<string, unknown> {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
    )
      throw new BadRequestException('Invalid export request');
    return value as Record<string, unknown>;
  }

  private context(
    user: UserDetails,
    req: Request & { credential?: string },
    expected: unknown
  ) {
    if (
      !user ||
      !req.credential ||
      !['client-interface', 'local-hub'].includes(user.appId ?? '')
    )
      throw new ForbiddenException('Account export unavailable');
    if (typeof expected !== 'string' || !UUID.test(expected))
      throw new BadRequestException('Invalid account confirmation');
    if (expected.toLowerCase() !== user.userId.toLowerCase())
      throw new ConflictException(
        'Your signed-in account changed. Refresh before continuing.'
      );
    return {
      accountId: user.userId,
      appId: user.appId!,
      token: req.credential,
    };
  }

  private async run(
    command: string,
    context: {
      accountId: string;
      appId: string;
      token: string;
      jobId?: string;
      idempotencyKey?: string;
    },
    empty = false
  ) {
    let value: AccountExportJobStatus | null;
    try {
      value = await firstValueFrom(
        this.auth.send({ cmd: command }, context).pipe(timeout(15000))
      );
    } catch (error) {
      const candidate = error as { statusCode?: unknown; status?: unknown };
      const status = Number(candidate?.statusCode ?? candidate?.status);
      if ([400, 401, 403, 404, 409, 429, 503].includes(status))
        throw new HttpException(
          status === 409
            ? 'Another export is already running. Refresh its status.'
            : status === 401
            ? 'Sign in again to continue.'
            : 'Account export is unavailable. Try again.',
          status
        );
      throw new BadGatewayException(
        'Account export is unavailable. Try again.'
      );
    }
    if (empty && value === null) return null;
    if (
      !value ||
      value.accountId !== context.accountId ||
      value.appId !== context.appId ||
      !UUID.test(value.jobId) ||
      (context.jobId && value.jobId !== context.jobId) ||
      !['queued', 'running', 'complete', 'incomplete', 'failed'].includes(
        value.state
      )
    )
      throw new BadGatewayException('Invalid export status');
    const download = `/api/authentication/account-export/${value.jobId}/download`;
    const ready =
      value.state === 'complete' &&
      value.coverageSummary?.['artifactAvailable'] === true &&
      value.artifactUrl === download;
    // Do not proxy arbitrary coverage metadata or private artifact descriptors to UI.
    return {
      jobId: value.jobId,
      accountId: value.accountId,
      appId: value.appId,
      state: value.state,
      downloadUrl: ready ? download : null,
    };
  }
}
