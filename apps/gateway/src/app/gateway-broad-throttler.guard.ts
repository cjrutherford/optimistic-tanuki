import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { gatewayThrottleLimits } from './throttler-config';

/**
 * A coarse gateway-wide ceiling keyed by the actual socket peer. This guard
 * deliberately ignores route @Throttle metadata; otherwise a pre-auth global
 * guard would apply the tighter identity-write allowance to a shared proxy IP
 * before AuthGuard can establish the account. Sensitive routes add the
 * identity-keyed guard after authentication.
 */
@Injectable()
export class GatewayBroadThrottlerGuard extends ThrottlerGuard {
  private writeHeader(
    response: {
      header?: (name: string, value: string | number) => unknown;
      setHeader?: (name: string, value: string | number) => unknown;
    },
    name: string,
    value: string | number
  ): void {
    if (typeof response.header === 'function') {
      response.header(name, value);
      return;
    }
    if (typeof response.setHeader === 'function') {
      response.setHeader(name, value);
      return;
    }
    throw new TypeError('HTTP response does not support setting headers.');
  }

  async canActivate(context: Parameters<ThrottlerGuard['canActivate']>[0]) {
    if (context.getType() !== 'http') return true;
    if (await this.shouldSkip(context)) return true;

    const { req, res } = this.getRequestResponse(context);
    const socket = req.socket as { remoteAddress?: unknown } | undefined;
    const peer =
      typeof socket?.remoteAddress === 'string'
        ? socket.remoteAddress
        : 'unknown';

    for (const limit of gatewayThrottleLimits()) {
      const name = `network_${limit.name}`;
      const key = this.generateKey(context, `ip:${peer}`, name);
      const result = await this.storageService.increment(
        key,
        limit.ttl,
        limit.limit,
        limit.ttl,
        name
      );
      if (result.isBlocked) {
        await this.throwThrottlingException(context, {
          limit: limit.limit,
          ttl: limit.ttl,
          key,
          tracker: `ip:${peer}`,
          totalHits: result.totalHits,
          timeToExpire: result.timeToExpire,
          isBlocked: result.isBlocked,
          timeToBlockExpire: result.timeToBlockExpire,
        });
      }
      this.writeHeader(res, `X-RateLimit-${name}-Limit`, limit.limit);
      this.writeHeader(
        res,
        `X-RateLimit-${name}-Remaining`,
        Math.max(0, limit.limit - result.totalHits)
      );
      this.writeHeader(res, `X-RateLimit-${name}-Reset`, result.timeToExpire);
    }
    return true;
  }
}
