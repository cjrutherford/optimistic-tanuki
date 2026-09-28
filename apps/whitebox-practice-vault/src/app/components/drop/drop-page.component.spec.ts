import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { DocumentAuditResponseDto } from '@optimistic-tanuki/models';
import { DropPageComponent } from './drop-page.component';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';

describe('DropPageComponent', () => {
  let component: DropPageComponent;
  let fixture: ComponentFixture<DropPageComponent>;
  let apiMock: { uploadDocument: jest.Mock };
  let routeToken: string | null;

  beforeEach(async () => {
    routeToken = 'test-drop-token';
    apiMock = {
      uploadDocument: jest.fn().mockReturnValue(
        of({
          id: 'log-1',
          tenantId: 'wirepro-cpa',
          documentId: 'test-drop-token',
          fileName: 'TaxReturn.pdf',
          documentHash: 'hash-abc',
          previousHash: '0'.repeat(64),
          chainedHash: 'chained-xyz-123',
          antivirusStatus: 'clean',
          complianceStandard:
            'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
          wispCompliant: true,
          timestamp: new Date(),
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [DropPageComponent],
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

    fixture = TestBed.createComponent(DropPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('initializes with token from activated route', () => {
    expect(component.token).toBe('test-drop-token');
    const metaVal = fixture.nativeElement.querySelector('.meta-value');
    expect(metaVal.textContent).toContain('test-drop-token');
  });

  it('renders statutory headings without slice or whitebox copy', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('whitebox');
    expect(text).not.toContain('slice');
    expect(text).toContain('Client document drop');
    expect(text).toContain('FTC 16 CFR Part 314');
  });

  it('starts the real upload immediately after reading the file', () => {
    jest.useFakeTimers();
    const request = new Subject<DocumentAuditResponseDto>();
    apiMock.uploadDocument.mockReturnValue(request);
    const file = new File(['tax return'], 'return.pdf', {
      type: 'application/pdf',
    });
    const reader = {
      result: `data:application/pdf;base64,${Buffer.from('tax return').toString(
        'base64'
      )}`,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      readAsDataURL: jest.fn(),
    };
    reader.readAsDataURL.mockImplementation(() => reader.onload?.());
    jest
      .spyOn(window, 'FileReader')
      .mockImplementation(() => reader as unknown as FileReader);

    component.onFileSelected(file);

    expect(apiMock.uploadDocument).toHaveBeenCalledTimes(1);
    expect(component.isScanning).toBe(true);
    expect(component.scanStatus).toContain('Uploading document');
    expect(component.scanStatus).not.toMatch(/\d+%/);

    const result: DocumentAuditResponseDto = {
      id: 'log-1',
      tenantId: 'wirepro-cpa',
      documentId: 'test-drop-token',
      fileName: 'return.pdf',
      documentHash: 'document-hash',
      previousHash: '0'.repeat(64),
      chainedHash: 'chained-hash',
      antivirusStatus: 'clean',
      complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314',
      wispCompliant: true,
      timestamp: new Date(),
      scannedAt: new Date(),
    };
    request.next(result);
    request.complete();

    expect(component.isScanning).toBe(false);
    expect(component.auditResult).toEqual(result);
  });

  it('does not read or upload a document without a route token', () => {
    const file = new File(['tax return'], 'return.pdf', {
      type: 'application/pdf',
    });
    const reader = { readAsDataURL: jest.fn() };
    jest
      .spyOn(window, 'FileReader')
      .mockImplementation(() => reader as unknown as FileReader);
    component.token = '';

    component.onFileSelected(file);

    expect(reader.readAsDataURL).not.toHaveBeenCalled();
    expect(apiMock.uploadDocument).not.toHaveBeenCalled();
    expect(component.uploadError).toContain('token is required');
  });

  it('does not supply a token when the route has none', () => {
    fixture.destroy();
    routeToken = null;
    fixture = TestBed.createComponent(DropPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.token).toBe('');
    expect(component.uploadError).toContain('token is required');
  });
});
