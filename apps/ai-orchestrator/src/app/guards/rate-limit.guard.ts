import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // For Microservices, 'req' is the data payload
    if (req.profileId) {
      return req.profileId;
    }
    if (
      req.conversation &&
      req.conversation.participants &&
      req.conversation.participants.length > 0
    ) {
      // Use the first participant as the tracker for now, or a composite key
      return req.conversation.participants[0];
    }
    if (req.userId) {
      return req.userId;
    }

    // Fallback to a generic key if no user identifier is found (not ideal for per-user limits)
    return 'global';
  }

  protected async throwThrottlingException(
    context: ExecutionContext
  ): Promise<void> {
    throw new RpcException('Rate limit exceeded');
  }
}
