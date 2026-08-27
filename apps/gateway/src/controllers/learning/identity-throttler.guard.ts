import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting keyed to who is asking, not where they are asking from.
 *
 * The default guard tracks by IP, which is the wrong unit for this platform
 * in both directions. A classroom or an office behind one address shares a
 * single allowance, so one busy learner throttles everybody sitting near
 * them. And an account is free to move between addresses, so an IP limit does
 * not actually bound what one identity can spend.
 *
 * The routes this protects are the expensive ones. Running code compiles and
 * executes it in a sandbox with a ten second ceiling, and marking a written
 * answer calls a language model. Both cost real time on shared machines, and
 * neither is something a person does hundreds of times a minute.
 *
 * Unauthenticated requests fall back to the IP, which is all there is to go
 * on. In practice these routes all sit behind AuthGuard, so that path is a
 * safety net rather than the normal case.
 */
@Injectable()
export class IdentityThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req?.['user'] as { userId?: unknown } | undefined;
    if (typeof user?.userId === 'string' && user.userId) {
      // Namespaced so a user id can never collide with an address.
      return `user:${user.userId}`;
    }
    return `ip:${await super.getTracker(req)}`;
  }
}
