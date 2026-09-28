import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { TimeLockedOtpGuard } from './time-locked-otp.guard';

export const TIME_LOCKED_OTP_KEY = 'TIME_LOCKED_OTP';

export interface TimeLockedOtpOptions {
  windowSeconds?: number;
  headerName?: string;
  bodyField?: string;
}

/**
 * Decorates a route handler to require valid rolling 6-digit TOTP verification before access.
 * Satisfies ALTA Pillar 3 escrow wire fraud defense requirements.
 */
export function TimeLockedOtp(
  options: TimeLockedOtpOptions = {}
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(TIME_LOCKED_OTP_KEY, options),
    UseGuards(TimeLockedOtpGuard)
  );
}
