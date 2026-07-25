import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import { OwnerAuthorizationService } from './owner-authorization.service';

export const ADMIN_API_PUBLIC_KEY = 'admin-api-public';
export const ADMIN_API_LOOPBACK_KEY = 'admin-api-loopback';

@Injectable()
export class OwnerAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: OwnerAuthorizationService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();
    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_API_PUBLIC_KEY, [
        handler,
        controller,
      ])
    ) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_API_LOOPBACK_KEY, [
        handler,
        controller,
      ]) &&
      (this.isLoopback(request.socket?.remoteAddress) ||
        this.hasValidBootstrapToken(request.headers['x-admin-bootstrap-token']))
    ) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_API_LOOPBACK_KEY, [
        handler,
        controller,
      ]) &&
      !request.headers.authorization
    ) {
      throw new UnauthorizedException(
        'Bootstrap access is restricted to loopback'
      );
    }

    await this.authorization.assertAuthorized(request.headers.authorization);
    return true;
  }

  private isLoopback(address?: string): boolean {
    return (
      address === '127.0.0.1' ||
      address === '::1' ||
      address === '::ffff:127.0.0.1'
    );
  }

  private hasValidBootstrapToken(value?: string | string[]): boolean {
    const configuredToken = this.config.get<string>('admin-api.bootstrapToken');
    const suppliedToken = Array.isArray(value) ? value[0] : value;
    if (!configuredToken || !suppliedToken) return false;

    const expected = Buffer.from(configuredToken);
    const supplied = Buffer.from(suppliedToken);
    return (
      expected.length === supplied.length && timingSafeEqual(expected, supplied)
    );
  }
}
