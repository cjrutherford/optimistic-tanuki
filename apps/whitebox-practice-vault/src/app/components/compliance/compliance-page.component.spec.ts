import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CompliancePageComponent } from './compliance-page.component';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';

describe('CompliancePageComponent', () => {
  let component: CompliancePageComponent;
  let fixture: ComponentFixture<CompliancePageComponent>;
  let apiMock: {
    getWispComplianceAudit: jest.Mock;
    exportWispAudit: jest.Mock;
    queryCopilot: jest.Mock;
  };

  beforeEach(async () => {
    apiMock = {
      getWispComplianceAudit: jest.fn().mockReturnValue(
        of({
          chainValid: true,
          totalRecords: 1,
          complianceStandard:
            'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
          generatedAt: new Date(),
          records: [
            {
              id: 'rec-1',
              tenantId: 'wirepro-legal',
              documentId: 'escrow-closing-8821',
              fileName: 'Closing-Doc.pdf',
              documentHash: 'd-hash-1',
              previousHash: '0'.repeat(64),
              chainedHash: 'c-hash-1',
              antivirusStatus: 'clean',
              complianceStandard: 'ALTA Pillar 3',
              timestamp: new Date(),
            },
          ],
        })
      ),
      queryCopilot: jest.fn().mockReturnValue(
        of({
          answer: 'Tax deduction verified locally.',
          model: 'qwen2.5-coder:14b',
          sources: [{ documentId: 'doc-1', excerpt: 'IRS Pub 4557 Section 3' }],
          airGapped: true,
          timestamp: new Date(),
        })
      ),
      exportWispAudit: jest
        .fn()
        .mockReturnValue(
          of(new Blob(['rowType,tenantId'], { type: 'text/csv' }))
        ),
    };

    await TestBed.configureTestingModule({
      imports: [CompliancePageComponent],
      providers: [
        provideRouter([]),
        { provide: PracticeVaultApiService, useValue: apiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompliancePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders WISP compliance ledger and verified chain status', () => {
    expect(component).toBeTruthy();
    const statVal = fixture.nativeElement.querySelector(
      '.stat-value.valid-chain'
    );
    expect(statVal.textContent).toContain('VERIFIED INTACT');
    expect(component.records.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain(
      'Object Lock Active'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Not reported by ledger API'
    );
  });

  it('queries air-gapped copilot and displays verified citations', () => {
    component.copilotQuery = 'What are the IRS Pub 4557 requirements?';
    component.runCopilotQuery();
    fixture.detectChanges();

    expect(apiMock.queryCopilot).toHaveBeenCalledWith({
      query: 'What are the IRS Pub 4557 requirements?',
    });
    expect(component.copilotResult?.airGapped).toBe(true);
    expect(component.copilotResult?.answer).toBe(
      'Tax deduction verified locally.'
    );
  });

  it('does not advertise a demo document-drop route in the empty state', () => {
    component.records = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Use the secure document-drop link provided for this session'
    );
    expect(fixture.nativeElement.textContent).not.toContain('demo-cpa-token');
  });

  it('shows an unavailable ledger instead of fabricated audit rows', () => {
    apiMock.getWispComplianceAudit.mockReturnValue(
      throwError(() => new Error('ledger unavailable'))
    );

    component.loadAuditLogs();
    fixture.detectChanges();

    expect(component.wispAudit).toBeNull();
    expect(component.records).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Ledger unavailable');
    expect(
      fixture.nativeElement.querySelectorAll('.stat-value')[1].textContent
    ).toContain('Unavailable');
    expect(fixture.nativeElement.textContent).toContain(
      'Ledger unavailable; record count is unknown.'
    );
    expect(fixture.nativeElement.textContent).not.toContain('VERIFIED INTACT');
    expect(fixture.nativeElement.textContent).not.toContain(
      'IRS-Form-1040-Client.pdf'
    );
  });

  it('surfaces an unauthenticated staff denial without showing ledger data', () => {
    apiMock.getWispComplianceAudit.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            error: { message: 'Unauthorized' },
          })
      )
    );

    component.loadAuditLogs();
    fixture.detectChanges();

    expect(component.wispAudit).toBeNull();
    expect(component.records).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'authorized staff account'
    );
    expect(
      fixture.nativeElement.querySelector('[data-testid="staff-auth-error"]')
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('VERIFIED INTACT');
  });

  it('shows an unavailable Copilot instead of a fabricated answer', () => {
    apiMock.queryCopilot.mockReturnValue(
      throwError(() => new Error('copilot unavailable'))
    );
    component.copilotQuery = 'Check escrow status';
    component.runCopilotQuery();
    fixture.detectChanges();

    expect(component.copilotResult).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Copilot unavailable');
    expect(fixture.nativeElement.textContent).not.toContain(
      'All documents parsed locally without cloud egress'
    );
  });

  it('labels an unavailable model response without claiming air-gapped success', () => {
    apiMock.queryCopilot.mockReturnValue(
      of({
        answer: 'Vault Copilot is unavailable.',
        model: 'qwen2.5-coder:14b',
        sources: [],
        airGapped: false,
        timestamp: new Date(),
      })
    );
    component.copilotQuery = 'Check escrow status';
    component.runCopilotQuery();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.airgap-badge').textContent
    ).toContain('Unavailable');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Air-gapped: zero cloud leakage'
    );
  });

  it('does not style a non-clean scan status as clean', () => {
    component.records = [
      {
        ...component.records[0],
        antivirusStatus: 'infected',
      },
    ];
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status-pill');
    expect(status.textContent).toContain('INFECTED');
    expect(status.classList).not.toContain('status-clean');
    expect(status.classList).toContain('status-alert');
  });

  it('downloads the WISP export as a CSV file', () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:export');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    component.exportAudit('csv');
    fixture.detectChanges();

    expect(apiMock.exportWispAudit).toHaveBeenCalledWith('csv');
    expect(component.isExporting).toBe(false);
    expect(component.exportError).toBe('');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    click.mockRestore();
  });

  it('shows a truthful export error and downloads nothing on export failure', () => {
    apiMock.exportWispAudit.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            statusText: 'Service Unavailable',
            error: { message: 'Export unavailable' },
          })
      )
    );
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    component.exportAudit('csv');
    fixture.detectChanges();

    expect(component.isExporting).toBe(false);
    expect(component.exportError).toBe(
      'The compliance export failed. Nothing was downloaded.'
    );
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows the staff-auth error for an unauthenticated export', () => {
    apiMock.exportWispAudit.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            error: { message: 'Unauthorized' },
          })
      )
    );

    component.exportAudit('json');
    fixture.detectChanges();

    expect(component.exportError).toContain('Staff authentication is required');
  });

  it('renders an accessible ledger table and labeled copilot input', () => {
    const caption = fixture.nativeElement.querySelector('.audit-table caption');
    expect(caption.textContent).toContain('WISP audit ledger');
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('.audit-table th')
    );
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((th) => {
      expect((th as HTMLElement).getAttribute('scope')).toBe('col');
    });
    const copilotInput = fixture.nativeElement.querySelector('#copilot-query');
    expect(copilotInput).toBeTruthy();
    const label = fixture.nativeElement.querySelector(
      'label[for="copilot-query"]'
    );
    expect(label).toBeTruthy();
  });
});
