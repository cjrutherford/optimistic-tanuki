import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { GuardianConsentComponent } from './guardian-consent.component';

describe('GuardianConsentComponent', () => {
  let fixture: ComponentFixture<GuardianConsentComponent>;
  let component: GuardianConsentComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuardianConsentComponent, HttpClientTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(GuardianConsentComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('keeps the withdrawal capability in the guardian response and reports applicant mail failure accurately', async () => {
    component.token = 'guardian-one-use-token';
    component.guardianEmail = 'guardian@example.invalid';
    component.attested = true;

    const pending = component.submit();
    const request = http.expectOne('/api/authentication/guardian-consent/attest');
    expect(request.request.method).toBe('POST');
    request.flush({
      attested: true,
      applicantNotified: false,
      continuationRequired: true,
      withdrawalUrl:
        'https://app.example.invalid/auth/guardian-consent#withdrawToken=guardian-control',
    });
    await pending;
    fixture.detectChanges();

    expect(component.withdrawalToken).toBe('guardian-control');
    expect(component.message).toContain('could not be sent');
    expect(component.message).not.toContain('was sent');
    expect(fixture.nativeElement.textContent).toContain(
      'Copy private permission control link'
    );
  });

  it('does not offer applicant resend for an approved existing account', async () => {
    component.token = 'guardian-one-use-token';
    component.guardianEmail = 'guardian@example.invalid';
    component.attested = true;

    const pending = component.submit();
    http.expectOne('/api/authentication/guardian-consent/attest').flush({
      attested: true,
      applicantNotified: false,
      continuationRequired: false,
      withdrawalUrl:
        'https://app.example.invalid/auth/guardian-consent#withdrawToken=guardian-control',
    });
    await pending;
    fixture.detectChanges();

    expect(component.message).toContain('existing account');
    expect(fixture.nativeElement.textContent).not.toContain('Retry applicant email');
  });

  it('retries only through the guardian control token and reflects delivery result', async () => {
    component.withdrawalToken = 'guardian-control';
    component.applicantNotified = false;

    const pending = component.resendApplicantLink();
    const request = http.expectOne(
      '/api/authentication/guardian-consent/resend-continuation'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'guardian-control' });
    request.flush({ sent: true });
    await pending;

    expect(component.applicantNotified).toBe(true);
    expect(component.message).toContain('was sent to the applicant');
  });
});
