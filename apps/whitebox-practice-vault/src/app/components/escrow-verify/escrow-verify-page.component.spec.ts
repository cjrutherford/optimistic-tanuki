import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EscrowVerifyPageComponent } from './escrow-verify-page.component';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';

describe('EscrowVerifyPageComponent', () => {
  let component: EscrowVerifyPageComponent;
  let fixture: ComponentFixture<EscrowVerifyPageComponent>;
  let apiMock: { verifyEscrowOtp: jest.Mock; requestEscrowSmsOtp: jest.Mock };
  let routeToken: string | null;

  beforeEach(async () => {
    routeToken = 'escrow-closing-8821';
    apiMock = {
      requestEscrowSmsOtp: jest
        .fn()
        .mockReturnValue(
          of({ sent: true, expiresAt: new Date().toISOString() })
        ),
      verifyEscrowOtp: jest.fn().mockReturnValue(
        of({
          escrowId: 'escrow-closing-8821',
          beneficiary: 'WirePro Title and Legal Escrow Trust',
          bankName: 'First Coastal Commercial Bank',
          routingNumber: '061000104',
          accountNumber: '482910482910',
          reference: 'ESCROW-CLOSING-8821-GA',
          verifiedAt: new Date(),
          expiresAt: new Date(),
          complianceNotice:
            'Protected by ALTA Pillar 3 Wire Fraud Defense protocol.',
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EscrowVerifyPageComponent],
      providers: [
        provideRouter([]),
        { provide: PracticeVaultApiService, useValue: apiMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'token' ? routeToken : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EscrowVerifyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders locked wire instructions state initially', () => {
    expect(component.wireDetails).toBeNull();
    const title = fixture.nativeElement.querySelector('.locked-title');
    expect(title.textContent).toContain('Wire instructions encrypted');
    const banner = fixture.nativeElement.querySelector('.verification-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('TOTP');
  });

  it('submits the rolling TOTP and unlocks wire instructions', () => {
    component.submitOtp('issued-otp');
    fixture.detectChanges();

    expect(apiMock.verifyEscrowOtp).toHaveBeenCalledWith(
      'escrow-closing-8821',
      {
        token: 'escrow-closing-8821',
        otpCode: 'issued-otp',
      }
    );
    expect(component.wireDetails).toBeTruthy();
    expect(component.wireDetails?.beneficiary).toBe(
      'WirePro Title and Legal Escrow Trust'
    );
  });

  it('shows a verbal callback-to-verify banner before any wire details', () => {
    const banner = fixture.nativeElement.querySelector('.callback-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('CALL BEFORE YOU WIRE');
    expect(banner.textContent).toContain('verbally confirm');
    expect(component.wireDetails).toBeNull();
  });

  it('dispatches an SMS code and reports delivery truthfully', () => {
    component.smsPhone = '+19125550100';
    component.requestSmsCode();
    fixture.detectChanges();

    expect(apiMock.requestEscrowSmsOtp).toHaveBeenCalledWith(
      'escrow-closing-8821',
      '+19125550100'
    );
    expect(component.smsStatus).toContain('dispatched');
    expect(component.isRequestingSms).toBe(false);
  });

  it('requires a phone number before dispatching an SMS code', () => {
    component.smsPhone = '   ';
    component.requestSmsCode();
    fixture.detectChanges();

    expect(apiMock.requestEscrowSmsOtp).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'destination phone number is required'
    );
  });

  it('reports SMS dispatch failures without claiming delivery', () => {
    apiMock.requestEscrowSmsOtp.mockReturnValue(
      throwError(() => new Error('Twilio down'))
    );
    component.smsPhone = '+19125550100';
    component.requestSmsCode();
    fixture.detectChanges();

    expect(component.smsStatus).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'could not be dispatched'
    );
  });

  it('uses a neutral authenticator prompt without a visible test code', () => {
    const input = fixture.nativeElement.querySelector('#otpInput');
    const text = fixture.nativeElement.textContent;

    expect(input.getAttribute('placeholder')).toBe(
      'Enter code from your authenticator'
    );
    expect(text).not.toContain('Test environment active');
  });

  it('binds the verification modal beneficiary to verified API data', () => {
    component.submitOtp('issued-otp');
    component.isModalOpen = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.escrow-meta').textContent
    ).toContain('WirePro Title and Legal Escrow Trust');
  });

  it('fails closed when the route has no escrow token', () => {
    fixture.destroy();
    routeToken = null;
    fixture = TestBed.createComponent(EscrowVerifyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.token).toBe('');
    expect(component.errorMessage).toContain(
      'Escrow verification token is required'
    );

    component.submitOtp('issued-otp');

    expect(apiMock.verifyEscrowOtp).not.toHaveBeenCalled();
  });
});
