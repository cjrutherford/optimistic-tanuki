import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PracticeVaultApiService } from './practice-vault-api.service';

describe('PracticeVaultApiService', () => {
  let service: PracticeVaultApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PracticeVaultApiService],
    });
    service = TestBed.inject(PracticeVaultApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uploads document and returns audit receipt', () => {
    service
      .uploadDocument('token-123', {
        token: 'token-123',
        fileName: 'IRS-1040.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
      })
      .subscribe((res) => {
        expect(res.chainedHash).toBe('hash-xyz');
      });

    const req = httpMock.expectOne('/api/v1/vault/drop/token-123');
    expect(req.request.method).toBe('POST');
    req.flush({ chainedHash: 'hash-xyz', wispCompliant: true });
  });

  it('verifies escrow wire OTP', () => {
    service
      .verifyEscrowOtp('escrow-token-42', {
        token: 'escrow-token-42',
        otpCode: 'issued-otp',
      })
      .subscribe((res) => {
        expect(res.accountNumber).toBe('482910482910');
      });

    const req = httpMock.expectOne(
      '/api/v1/vault/escrow-verify/escrow-token-42'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      token: 'escrow-token-42',
      otpCode: 'issued-otp',
    });
    req.flush({ accountNumber: '482910482910' });
  });

  it('retrieves WISP compliance ledger', () => {
    service.getWispComplianceAudit().subscribe((res) => {
      expect(res.chainValid).toBe(true);
    });

    const req = httpMock.expectOne('/api/v1/vault/compliance/wisp');
    expect(req.request.method).toBe('GET');
    expect(req.request.url).not.toContain('tenantId');
    req.flush({ chainValid: true, totalRecords: 0, records: [] });
  });

  it('uses the authenticated staff session without sending a tenant query parameter', () => {
    service.getWispComplianceAudit().subscribe();

    const req = httpMock.expectOne('/api/v1/vault/compliance/wisp');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-appscope')).toBe('finance');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush({ chainValid: true, totalRecords: 0, records: [] });
  });

  it('queries air-gapped copilot', () => {
    service
      .queryCopilot({
        query: 'Check Schedule C',
      })
      .subscribe((res) => {
        expect(res.airGapped).toBe(true);
      });

    const req = httpMock.expectOne('/api/v1/vault/copilot/query');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-appscope')).toBe('finance');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush({ answer: 'Clean', airGapped: true, sources: [] });
  });

  it('propagates document upload failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service
      .uploadDocument('token-123', {
        token: 'token-123',
        fileName: 'IRS-1040.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
      })
      .subscribe({ next, error });

    const req = httpMock.expectOne('/api/v1/vault/drop/token-123');
    req.flush(
      { message: 'ClamAV service is unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(error.mock.calls[0][0].status).toBe(503);
  });

  it('propagates escrow OTP failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service
      .verifyEscrowOtp('escrow-token-42', {
        token: 'escrow-token-42',
        otpCode: 'rejected-otp',
      })
      .subscribe({ next, error });

    const req = httpMock.expectOne(
      '/api/v1/vault/escrow-verify/escrow-token-42'
    );
    req.flush(
      { message: 'Invalid or expired code' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(error.mock.calls[0][0].status).toBe(401);
  });

  it('exports the WISP ledger as a CSV blob with the staff session', () => {
    service.exportWispAudit('csv').subscribe((blob) => {
      expect(blob).toBeInstanceOf(Blob);
    });

    const req = httpMock.expectOne(
      '/api/v1/vault/compliance/wisp/export?format=csv'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-appscope')).toBe('finance');
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush(new Blob(['rowType,tenantId'], { type: 'text/csv' }));
  });

  it('exports the WISP ledger as JSON with the staff session', () => {
    service.exportWispAudit('json').subscribe((blob) => {
      expect(blob).toBeInstanceOf(Blob);
    });

    const req = httpMock.expectOne(
      '/api/v1/vault/compliance/wisp/export?format=json'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['{"records":[]}'], { type: 'application/json' }));
  });

  it('requests an escrow SMS code without a staff session', () => {
    service
      .requestEscrowSmsOtp('escrow-token-42', '+19125550100')
      .subscribe((res) => {
        expect(res.sent).toBe(true);
      });

    const req = httpMock.expectOne(
      '/api/v1/vault/escrow-verify/escrow-token-42/sms'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      token: 'escrow-token-42',
      phoneNumber: '+19125550100',
    });
    expect(req.request.withCredentials).toBeFalsy();
    req.flush({ sent: true, expiresAt: new Date().toISOString() });
  });

  it('propagates escrow SMS failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service
      .requestEscrowSmsOtp('escrow-token-42', '+19125550100')
      .subscribe({ next, error });

    const req = httpMock.expectOne(
      '/api/v1/vault/escrow-verify/escrow-token-42/sms'
    );
    req.flush(
      { message: 'SMS dispatch failed' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
  });

  it('propagates WISP export failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service.exportWispAudit('csv').subscribe({ next, error });

    const req = httpMock.expectOne(
      '/api/v1/vault/compliance/wisp/export?format=csv'
    );
    req.error(new ProgressEvent('error'), {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(error.mock.calls[0][0].status).toBe(401);
  });

  it('propagates WISP ledger failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service.getWispComplianceAudit().subscribe({ next, error });

    const req = httpMock.expectOne('/api/v1/vault/compliance/wisp');
    req.flush(
      { message: 'Audit ledger unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(error.mock.calls[0][0].status).toBe(503);
  });

  it('propagates copilot failures', () => {
    const next = jest.fn();
    const error = jest.fn();
    service
      .queryCopilot({ query: 'Check Schedule C' })
      .subscribe({ next, error });

    const req = httpMock.expectOne('/api/v1/vault/copilot/query');
    req.flush(
      { message: 'Ollama unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(error.mock.calls[0][0].status).toBe(503);
  });
});
