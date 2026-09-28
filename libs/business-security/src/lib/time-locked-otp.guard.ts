import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TimeLockedOtpSecretResolver,
  TimeLockedOtpService,
} from './time-locked-otp.service';
import {
  TIME_LOCKED_OTP_KEY,
  TimeLockedOtpOptions,
} from './time-locked-otp.decorator';

export const TIME_LOCKED_OTP_SECRET_RESOLVER =
  'TIME_LOCKED_OTP_SECRET_RESOLVER';

@Injectable()
export class TimeLockedOtpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly otpService?: TimeLockedOtpService,
    @Optional()
    @Inject(TIME_LOCKED_OTP_SECRET_RESOLVER)
    private readonly secretResolver?: TimeLockedOtpSecretResolver
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      !context ||
      typeof context.getHandler !== 'function' ||
      typeof context.getClass !== 'function'
    ) {
      throw new UnauthorizedException('Request context is required.');
    }

    const options = this.reflector.getAllAndOverride<TimeLockedOtpOptions>(
      TIME_LOCKED_OTP_KEY,
      [context.getHandler(), context.getClass()]
    );
    const request = this.getRequest(context);
    const headerName = options?.headerName?.toLowerCase() || 'x-otp-code';
    const bodyField = options?.bodyField || 'otpCode';
    const otpCode = this.getOtpCode(request, headerName, bodyField);
    const token = this.getToken(request);

    if (!otpCode || !token) {
      throw new UnauthorizedException(
        'A valid OTP and escrow token are required for escrow wire access.'
      );
    }

    const service = this.otpService;
    if (!service) {
      throw new ServiceUnavailableException(
        'OTP verification is not configured with an explicit challenge store.'
      );
    }
    let secret: string | undefined;
    if (this.secretResolver) {
      try {
        secret = await this.secretResolver(token);
      } catch {
        throw new ForbiddenException(
          'OTP verification could not establish a server-side credential.'
        );
      }
    }

    const isValid = await service.verifyOtp(
      token,
      otpCode,
      secret,
      options?.windowSeconds,
      {
        tenantId: request['tenantId'] || request['tenant']?.tenantId,
        purpose: 'time-locked-otp',
      }
    );
    if (!isValid) {
      throw new ForbiddenException(
        'Invalid or expired time-locked rolling OTP code. Verification rejected.'
      );
    }

    request['otpVerified'] = true;
    return true;
  }

  private getRequest(context: ExecutionContext): Record<string, any> {
    if (!context || typeof context.switchToHttp !== 'function') {
      throw new UnauthorizedException('Request context is required.');
    }
    const request = context.switchToHttp()?.getRequest?.();
    if (!request || typeof request !== 'object') {
      throw new UnauthorizedException('Request context is required.');
    }
    return request as Record<string, any>;
  }

  private getOtpCode(
    request: Record<string, any>,
    headerName: string,
    bodyField: string
  ): string | undefined {
    const candidates = [
      request['headers']?.[headerName],
      request['headers']?.['x-wire-otp'],
      request['body']?.[bodyField],
      request['body']?.otp,
    ];
    return candidates.find(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
  }

  private getToken(request: Record<string, any>): string | undefined {
    const token =
      request['params']?.token ||
      request['body']?.token ||
      request['headers']?.['x-escrow-token'];
    return typeof token === 'string' && token.trim() ? token.trim() : undefined;
  }
}
