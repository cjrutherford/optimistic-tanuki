import { TimeLockedOtpService } from './time-locked-otp.service';
import { OTP_CHALLENGE_STORE } from './otp-challenge.store';
import { OTP_SMS_DISPATCHER } from './twilio-otp-sms.dispatcher';
import { BusinessSecurityModule } from './business-security.module';

describe('BusinessSecurityModule OTP wiring', () => {
  it('does not register an OTP service without explicit persistence and SMS providers', () => {
    const dynamicModule = BusinessSecurityModule.forRoot();

    expect(dynamicModule.providers).not.toContain(TimeLockedOtpService);
  });

  it('registers the OTP service only when both providers are explicit', () => {
    const storeProvider = { provide: OTP_CHALLENGE_STORE, useValue: {} };
    const smsProvider = { provide: OTP_SMS_DISPATCHER, useValue: {} };
    const dynamicModule = BusinessSecurityModule.forRoot({
      otpChallengeStoreProvider: storeProvider,
      otpSmsDispatcherProvider: smsProvider,
    });

    expect(dynamicModule.providers).toContain(storeProvider);
    expect(dynamicModule.providers).toContain(smsProvider);
    expect(dynamicModule.providers).toContain(TimeLockedOtpService);
    expect(dynamicModule.exports).toContain(TimeLockedOtpService);
  });

  it('rejects an incomplete explicit OTP configuration', () => {
    expect(() =>
      BusinessSecurityModule.forRoot({
        otpChallengeStoreProvider: {
          provide: OTP_CHALLENGE_STORE,
          useValue: {},
        },
      })
    ).toThrow('Both an OTP challenge store and SMS dispatcher');
  });
});
