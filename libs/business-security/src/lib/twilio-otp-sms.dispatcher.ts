import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OtpSmsDispatchRequest {
  to: string;
  code: string;
  tenantId: string;
  purpose: string;
}

export interface OtpSmsDispatchResult {
  messageId: string;
}

export interface OtpSmsDispatcher {
  dispatchOtp(request: OtpSmsDispatchRequest): Promise<OtpSmsDispatchResult>;
}

export const OTP_SMS_DISPATCHER = 'OTP_SMS_DISPATCHER';

@Injectable()
export class TwilioOtpSmsDispatcher implements OtpSmsDispatcher {
  constructor(@Optional() private readonly configService?: ConfigService) {}

  async dispatchOtp(
    request: OtpSmsDispatchRequest
  ): Promise<OtpSmsDispatchResult> {
    const accountSid = this.getConfig('TWILIO_ACCOUNT_SID');
    const authToken = this.getConfig('TWILIO_AUTH_TOKEN');
    const fromPhone = this.getConfig('TWILIO_PHONE_NUMBER');
    if (!accountSid || !authToken || !fromPhone) {
      throw new ServiceUnavailableException(
        'Twilio SMS is not configured; OTP issuance denied.'
      );
    }
    if (!request.to.trim() || !/^\d{6}$/.test(request.code)) {
      throw new ServiceUnavailableException(
        'OTP SMS delivery input is invalid.'
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${accountSid}:${authToken}`
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: request.to,
            From: fromPhone,
            Body: `Your ${request.purpose} verification code is ${request.code}.`,
          }).toString(),
        }
      );
    } catch {
      throw new ServiceUnavailableException(
        'Twilio SMS dispatch failed; OTP issuance denied.'
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Twilio SMS dispatch failed with status ${response.status}; OTP issuance denied.`
      );
    }

    let payload: { sid?: unknown };
    try {
      payload = (await response.json()) as { sid?: unknown };
    } catch {
      throw new ServiceUnavailableException(
        'Twilio SMS returned an invalid response; OTP issuance denied.'
      );
    }
    if (typeof payload.sid !== 'string' || !payload.sid) {
      throw new ServiceUnavailableException(
        'Twilio SMS did not return a message id; OTP issuance denied.'
      );
    }
    return { messageId: payload.sid };
  }

  private getConfig(key: string): string | undefined {
    const configured = this.configService?.get<string>(key)?.trim();
    return configured || process.env[key]?.trim() || undefined;
  }
}
