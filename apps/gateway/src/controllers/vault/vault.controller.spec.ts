import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
  RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { of, throwError, Observable } from 'rxjs';
import { VaultController } from './vault.controller';
import {
  VAULT_VERIFY_ESCROW_OTP,
  VAULT_ISSUE_TOKEN,
  VAULT_REGISTER_ESCROW,
  VAULT_REQUEST_WIRE_SMS_OTP,
  VAULT_VERIFY_TWILIO_PROVIDER,
  VAULT_APPEND_AUDIT_EVENT,
  VAULT_EXPORT_WISP_AUDIT,
  VAULT_GET_WISP_AUDIT,
  VAULT_INGEST_DOCUMENT,
  VAULT_VALIDATE_TOKEN,
  VAULT_CONSUME_TOKEN,
  VAULT_REVOKE_TOKEN,
  COPILOT_QUERY_DOCUMENTS,
  FinanceTenantCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  InMemoryOtpChallengeStore,
  TimeLockedOtpService,
} from '@optimistic-tanuki/business-security';
import { GENESIS_COMPLIANCE_HASH } from '@optimistic-tanuki/business-security';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import {
  VAULT_TOKEN_PURPOSES,
  VaultTokenService,
} from '../../security/vault-token.service';
import { VaultTenantResolver } from '../../security/vault-tenant-resolver.service';

describe('VaultController', () => {
  let controller: VaultController;
  let financeClientMock: { send: jest.Mock };
  let aiClientMock: { send: jest.Mock };
  let complianceAuditClientMock: { send: jest.Mock };
  let otpService: TimeLockedOtpService;
  let vaultTokenService: VaultTokenService;
  let dropToken: string;
  let escrowToken: string;
  let escrowVerifyImpl: () => Observable<unknown>;
  let tenantResolveImpl: () => Observable<unknown>;
  let tokenStates: Map<string, { consumed: boolean; revoked: boolean }>;
  const originalVaultTokenSecret = process.env['VAULT_TOKEN_SECRET'];

  const auditRecord = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: 'audit-record-1',
    tenantId: 'wirepro-cpa',
    action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
    documentId: 'drop-token-123',
    fileName: 'IRS-Form-1040.pdf',
    documentHash: 'a'.repeat(64),
    previousHash: GENESIS_COMPLIANCE_HASH,
    chainedHash: 'b'.repeat(64),
    antivirusStatus: 'clean',
    complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
    metadata: {},
    timestamp: '2026-09-25T12:00:00.000Z',
    ...overrides,
  });

  const exportPayload = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    format: 'csv',
    tenantId: 'wirepro-cpa',
    generatedAt: '2026-09-25T12:00:00.000Z',
    totalRecords: 0,
    exportedRecords: 0,
    maxRecords: 10000,
    truncated: false,
    chainValid: true,
    exportedChainValid: true,
    fullChainValid: true,
    firstBrokenIndex: null,
    exportedFirstBrokenIndex: null,
    records: [],
    content: 'rowType,tenantId\r\nsummary,wirepro-cpa\r\n',
    contentType: 'text/csv; charset=utf-8',
    filename: 'wisp-compliance-audit-wirepro-cpa.csv',
    ...overrides,
  });

  beforeEach(async () => {
    process.env['VAULT_TOKEN_SECRET'] =
      'test-vault-token-secret-with-at-least-32-characters';
    dropToken = 'test-drop-token';
    escrowToken = 'test-escrow-token';
    tokenStates = new Map([
      [dropToken, { consumed: false, revoked: false }],
      [escrowToken, { consumed: false, revoked: false }],
    ]);
    const tokenClaims = (token: string) =>
      token === dropToken
        ? {
            tenantId: 'wirepro-cpa',
            documentId: 'drop-token-123',
            purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
            jti: 'jti-drop',
            iat: 1700000000,
            exp: 1999999999,
          }
        : token === escrowToken
        ? {
            tenantId: 'wirepro-cpa',
            documentId: 'escrow-42',
            purpose: VAULT_TOKEN_PURPOSES.ESCROW_WIRE,
            jti: 'jti-escrow',
            iat: 1700000000,
            exp: 1999999999,
          }
        : null;
    const checkToken = (payload: { token?: string; purpose?: string }) => {
      const claims = tokenClaims(payload?.token ?? '');
      const state = tokenStates.get(payload?.token ?? '');
      if (!claims || !state) {
        throw { statusCode: 401, message: 'Vault token is not active.' };
      }
      if (state.revoked) {
        throw { statusCode: 403, message: 'Vault token has been revoked.' };
      }
      if (state.consumed) {
        throw {
          statusCode: 401,
          message: 'Vault token has already been used.',
        };
      }
      if (payload?.purpose && payload.purpose !== claims.purpose) {
        throw {
          statusCode: 403,
          message: 'Vault token is not valid for this operation.',
        };
      }
      return claims;
    };
    escrowVerifyImpl = () => of({ accountNumber: '482910482910' });
    tenantResolveImpl = () => of({ id: 'wirepro-cpa' });
    financeClientMock = {
      send: jest.fn((pattern: unknown, payload: unknown) => {
        if (pattern === VAULT_VALIDATE_TOKEN) {
          return of(
            checkToken(payload as { token?: string; purpose?: string })
          );
        }
        if (pattern === VAULT_CONSUME_TOKEN) {
          const claims = checkToken(
            payload as { token?: string; purpose?: string }
          );
          tokenStates.set((payload as { token: string }).token, {
            consumed: true,
            revoked: false,
          });
          return of(claims);
        }
        if (pattern === VAULT_REVOKE_TOKEN) {
          const rawToken = (payload as { token?: string })?.token ?? '';
          const claims = tokenClaims(rawToken);
          if (!claims) {
            return throwError(() => ({
              statusCode: 401,
              message: 'Vault token is not active.',
            }));
          }
          tokenStates.set(rawToken, { consumed: false, revoked: true });
          return of(claims);
        }
        if (pattern === VAULT_VERIFY_ESCROW_OTP) {
          return escrowVerifyImpl();
        }
        if (pattern === VAULT_ISSUE_TOKEN) {
          return of({
            token: 'issued-test-token',
            jti: 'jti-issued',
            tenantId: 'wirepro-cpa',
            documentId: 'drop-99',
            purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }
        if (pattern === VAULT_REGISTER_ESCROW) {
          return of({
            token: 'registered-escrow',
            enrollmentUri:
              'otpauth://totp/Practice%20Vault?secret=JBSWY3DPEHPK3PXP&issuer=Practice%20Vault&algorithm=SHA1&digits=6&period=30',
            enrollmentExpiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }
        if (pattern === VAULT_REQUEST_WIRE_SMS_OTP) {
          return of({
            messageId: 'sms-test-1',
            expiresAt: new Date(Date.now() + 90000).toISOString(),
          });
        }
        if (pattern === VAULT_VERIFY_TWILIO_PROVIDER) {
          return of({
            configured: true,
            verified: true,
            accountSid: 'AC123',
          });
        }
        if (
          typeof pattern === 'object' &&
          pattern !== null &&
          (pattern as { cmd?: string }).cmd ===
            FinanceTenantCommands.GET_CURRENT_TENANT
        ) {
          return tenantResolveImpl();
        }
        return of({ id: 'wirepro-cpa' });
      }),
    };

    aiClientMock = {
      send: jest.fn(),
    };

    complianceAuditClientMock = {
      send: jest.fn().mockReturnValue(of(auditRecord())),
    };

    otpService = new TimeLockedOtpService(new InMemoryOtpChallengeStore(), {
      dispatchOtp: async () => ({ messageId: 'test-message' }),
    });
    vaultTokenService = new VaultTokenService(financeClientMock as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaultController],
      providers: [
        {
          provide: ServiceTokens.FINANCE_SERVICE,
          useValue: financeClientMock,
        },
        {
          provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
          useValue: aiClientMock,
        },
        {
          provide: ServiceTokens.COMPLIANCE_AUDIT_SERVICE,
          useValue: complianceAuditClientMock,
        },
        {
          provide: TimeLockedOtpService,
          useValue: otpService,
        },
        {
          provide: VaultTokenService,
          useValue: vaultTokenService,
        },
        VaultTenantResolver,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VaultController>(VaultController);
  });

  it('drops confidential client document and produces chained SHA-256 audit record', async () => {
    const mockReq = {
      tenantId: 'wirepro-cpa',
      ip: '127.0.0.1',
      antivirusStatus: 'clean',
    };

    const response = await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'IRS-Form-1040.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        fileBase64: Buffer.from('Confidential tax document content').toString(
          'base64'
        ),
      },
      mockReq
    );

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_APPEND_AUDIT_EVENT,
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
        documentId: 'drop-token-123',
        fileName: 'IRS-Form-1040.pdf',
        antivirusStatus: 'clean',
      })
    );
    expect(response.documentId).toBe('drop-token-123');
    expect(response.fileName).toBe('IRS-Form-1040.pdf');
    expect(response.antivirusStatus).toBe('clean');
    expect(response.wispCompliant).toBe(true);
    expect(response.chainedHash).toBeDefined();
    expect(response.chainedHash.length).toBe(64);
  });

  it('sends the persisted ledger tail hash back on the upload response', async () => {
    complianceAuditClientMock.send.mockReturnValue(
      of(
        auditRecord({
          previousHash: 'c'.repeat(64),
          chainedHash: 'd'.repeat(64),
        })
      )
    );

    const response = await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'IRS-Form-1040.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        fileBase64: Buffer.from('Confidential tax document content').toString(
          'base64'
        ),
      },
      {
        tenantId: 'wirepro-cpa',
        ip: '127.0.0.1',
        antivirusStatus: 'clean',
      }
    );

    expect(response.previousHash).toBe('c'.repeat(64));
    expect(response.chainedHash).toBe('d'.repeat(64));
  });

  it('rejects a document drop without a route or body token', async () => {
    await expect(
      controller.dropDocument(
        '',
        {
          token: '',
          fileName: 'IRS-Form-1040.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('Confidential tax document').toString(
            'base64'
          ),
        },
        {
          tenantId: 'wirepro-cpa',
          ip: '127.0.0.1',
          antivirusStatus: 'clean',
        }
      )
    ).rejects.toThrow(BadRequestException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects a document drop without file content', async () => {
    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: 'IRS-Form-1040.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
        },
        {
          tenantId: 'wirepro-cpa',
          ip: '127.0.0.1',
          antivirusStatus: 'clean',
        }
      )
    ).rejects.toThrow(BadRequestException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects a document drop without a verified file name', async () => {
    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: '',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
        },
        {
          tenantId: 'wirepro-cpa',
          ip: '127.0.0.1',
          antivirusStatus: 'clean',
          file: {
            buffer: Buffer.from('Confidential tax document'),
          },
        }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a document drop token from another tenant context', async () => {
    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: 'IRS-Form-1040.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('Confidential tax document').toString(
            'base64'
          ),
        },
        {
          tenantId: 'other-tenant',
          ip: '127.0.0.1',
          antivirusStatus: 'clean',
        }
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a document drop without a verified antivirus result', async () => {
    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: 'IRS-Form-1040.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('Confidential tax document').toString(
            'base64'
          ),
        },
        {
          tenantId: 'wirepro-cpa',
          ip: '127.0.0.1',
        }
      )
    ).rejects.toThrow(ServiceUnavailableException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects escrow verification without a route or body token', async () => {
    await expect(
      controller.verifyEscrowOtp(
        '',
        {
          token: '',
          otpCode: 'issued-otp',
        },
        { tenantId: 'wirepro-cpa' }
      )
    ).rejects.toThrow(BadRequestException);
    expect(financeClientMock.send).not.toHaveBeenCalled();
  });

  it('dispatches escrow wire verification over finance client', async () => {
    const mockWire = {
      escrowId: 'escrow-42',
      beneficiary: 'Coastal Title & Escrow Trust',
      bankName: 'First Coastal Commercial Bank',
      routingNumber: '061000104',
      accountNumber: '482910482910',
      reference: 'CLOSING-42',
      verifiedAt: new Date(),
      expiresAt: new Date(),
      complianceNotice: 'ALTA Pillar 3 Protected',
    };

    escrowVerifyImpl = () => of(mockWire);

    const result = await controller.verifyEscrowOtp(
      escrowToken,
      {
        token: escrowToken,
        otpCode: '123456',
      },
      { tenantId: 'wirepro-cpa' }
    );

    expect(financeClientMock.send).toHaveBeenCalledWith(
      VAULT_VERIFY_ESCROW_OTP,
      expect.objectContaining({
        token: 'escrow-42',
        otpCode: '123456',
      })
    );
    expect(result.beneficiary).toBe('Coastal Title & Escrow Trust');
    expect(result.accountNumber).toBe('482910482910');
  });

  it('reads the WISP audit ledger from the compliance-audit service', async () => {
    const mockWisp = {
      records: [],
      chainValid: true,
      totalRecords: 0,
      complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314',
      page: 1,
      limit: 100,
      generatedAt: new Date(),
    };

    complianceAuditClientMock.send.mockReturnValue(of(mockWisp));

    const result = await controller.getWispComplianceAudit({
      user: { userId: 'user-1', profileId: 'profile-1' },
    });

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_GET_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', page: undefined, limit: undefined }
    );
    expect(financeClientMock.send).toHaveBeenCalledWith(
      { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
  });

  it('forwards WISP pagination to the compliance-audit service', async () => {
    complianceAuditClientMock.send.mockReturnValue(
      of({
        records: [],
        chainValid: true,
        totalRecords: 0,
        complianceStandard: 'FTC Safeguards Rule 16 CFR Part 314',
        page: 3,
        limit: 25,
        generatedAt: new Date(),
      })
    );

    const result = await controller.getWispComplianceAudit(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      '3',
      '25'
    );

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_GET_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', page: 3, limit: 25 }
    );
    expect(result.page).toBe(3);
    expect(result.limit).toBe(25);
  });

  it('streams a tenant-scoped CSV WISP export with download headers', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;
    complianceAuditClientMock.send.mockReturnValue(of(exportPayload()));

    await controller.exportWispComplianceAudit(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      'csv',
      response
    );

    expect(financeClientMock.send).toHaveBeenCalledWith(
      { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_EXPORT_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', format: 'csv' }
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8'
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="wisp-compliance-audit-wirepro-cpa.csv"'
    );
    expect(Buffer.isBuffer(response.send.mock.calls[0][0])).toBe(true);
    expect(response.send.mock.calls[0][0].toString()).toBe(
      'rowType,tenantId\r\nsummary,wirepro-cpa\r\n'
    );
  });

  it('streams JSON with its matching safe filename and content type', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;
    complianceAuditClientMock.send.mockReturnValue(
      of(
        exportPayload({
          format: 'json',
          content: '{"records":[]}',
          contentType: 'application/json; charset=utf-8',
          filename: 'wisp-compliance-audit-wirepro-cpa.json',
        })
      )
    );

    await controller.exportWispComplianceAudit(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      'json',
      response
    );

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_EXPORT_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', format: 'json' }
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="wisp-compliance-audit-wirepro-cpa.json"'
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json; charset=utf-8'
    );
  });

  it('sanitizes the service filename before setting Content-Disposition', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;
    complianceAuditClientMock.send.mockReturnValue(
      of(
        exportPayload({
          filename: 'wisp"\\r\\n../../secret.csv',
        })
      )
    );

    await controller.exportWispComplianceAudit(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      'csv',
      response
    );

    const disposition = response.setHeader.mock.calls.find(
      ([name]) => name === 'Content-Disposition'
    )?.[1];
    expect(disposition).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.csv"$/
    );
    expect(disposition).not.toContain('\r');
    expect(disposition).not.toContain('\n');
  });

  it('rejects an unsupported export format before resolving a tenant', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await expect(
      controller.exportWispComplianceAudit(
        { user: { userId: 'user-1', profileId: 'profile-1' } },
        'xml',
        response
      )
    ).rejects.toThrow(BadRequestException);
    expect(financeClientMock.send).not.toHaveBeenCalled();
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('does not forward a caller-supplied tenant to the export service', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;
    complianceAuditClientMock.send.mockReturnValue(of(exportPayload()));

    await (controller as any).exportWispComplianceAudit(
      {
        user: { userId: 'user-1', profileId: 'profile-1' },
        tenantId: 'attacker-tenant',
      },
      'csv',
      response,
      'attacker-tenant'
    );

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_EXPORT_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', format: 'csv' }
    );
  });

  it('fails closed if the export service returns another tenant', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;
    complianceAuditClientMock.send.mockReturnValue(
      of(exportPayload({ tenantId: 'other-tenant' }))
    );

    await expect(
      controller.exportWispComplianceAudit(
        { user: { userId: 'user-1', profileId: 'profile-1' } },
        'csv',
        response
      )
    ).rejects.toThrow(ForbiddenException);
    expect(response.send).not.toHaveBeenCalled();
  });

  it('does not request an export when the principal has no tenant authorization', async () => {
    tenantResolveImpl = () =>
      throwError(() => ({ error: 'forbidden', statusCode: 403 }));
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    await expect(
      controller.exportWispComplianceAudit(
        { user: { userId: 'user-1', profileId: 'profile-1' } },
        'csv',
        response
      )
    ).rejects.toThrow(ForbiddenException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
    expect(response.send).not.toHaveBeenCalled();
  });

  it('dispatches air-gapped copilot document query over AI client', async () => {
    const mockCopilot = {
      answer: 'Deposition transcript confirms witness cross-examination facts.',
      model: 'qwen2.5-coder:14b',
      sources: [{ documentId: 'doc-1', excerpt: 'Transcript Line 45' }],
      airGapped: true,
      timestamp: new Date(),
    };

    aiClientMock.send.mockReturnValue(of(mockCopilot));

    const result = await controller.copilotQuery(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      {
        query: 'Check deposition cross-examination',
      }
    );

    expect(aiClientMock.send).toHaveBeenCalledWith(
      COPILOT_QUERY_DOCUMENTS,
      expect.objectContaining({ query: 'Check deposition cross-examination' })
    );
    expect(result.airGapped).toBe(true);
    expect(result.answer).toContain('Deposition transcript');
  });

  it("forwards the caller's own bearer token so the copilot can act as them", async () => {
    aiClientMock.send.mockReturnValue(
      of({
        answer: 'ok',
        model: 'qwen2.5-coder:14b',
        sources: [],
        airGapped: true,
        timestamp: new Date(),
      })
    );

    await controller.copilotQuery(
      {
        user: { userId: 'user-1', profileId: 'profile-1' },
        headers: { authorization: 'Bearer caller-token-abc' },
      } as never,
      { query: 'Check the manifest' }
    );

    expect(aiClientMock.send).toHaveBeenCalledWith(
      COPILOT_QUERY_DOCUMENTS,
      expect.objectContaining({ accessToken: 'caller-token-abc' })
    );
  });

  it('overwrites a token the caller put in the request body', async () => {
    aiClientMock.send.mockReturnValue(
      of({
        answer: 'ok',
        model: 'qwen2.5-coder:14b',
        sources: [],
        airGapped: true,
        timestamp: new Date(),
      })
    );

    await controller.copilotQuery(
      {
        user: { userId: 'user-1', profileId: 'profile-1' },
        headers: { authorization: 'Bearer caller-token-abc' },
      } as never,
      { query: 'Check the manifest', accessToken: 'stolen-token' } as never
    );

    const payload = aiClientMock.send.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload['accessToken']).toBe('caller-token-abc');
  });

  it('stores the readable text of a dropped document so the copilot has something to read', async () => {
    complianceAuditClientMock.send.mockReturnValue(of(auditRecord()));

    await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'deposition.txt',
        fileSizeBytes: 96,
        mimeType: 'text/plain',
        fileBase64: Buffer.from(
          'TRANSCRIPT OF PROCEEDINGS\nQ.  Are you the custodian?\nA.  I am.',
          'utf8'
        ).toString('base64'),
      },
      { tenantId: 'wirepro-cpa', ip: '127.0.0.1', antivirusStatus: 'clean' }
    );

    const ingest = complianceAuditClientMock.send.mock.calls.find(
      ([pattern]) => pattern === VAULT_INGEST_DOCUMENT
    );
    expect(ingest).toBeDefined();
    expect(ingest?.[1]).toEqual(
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        documentId: 'drop-token-123',
        fileName: 'deposition.txt',
        contentText: expect.stringContaining('I am.'),
      })
    );
  });

  it('still seals the upload when the document carries no readable text', async () => {
    complianceAuditClientMock.send.mockReturnValue(of(auditRecord()));

    const response = await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'scan.pdf',
        fileSizeBytes: 8,
        mimeType: 'application/pdf',
        fileBase64: Buffer.from('%PDF-1.7\n', 'utf8').toString('base64'),
      },
      { tenantId: 'wirepro-cpa', ip: '127.0.0.1', antivirusStatus: 'clean' }
    );

    const ingest = complianceAuditClientMock.send.mock.calls.find(
      ([pattern]) => pattern === VAULT_INGEST_DOCUMENT
    );
    expect(ingest?.[1]).toEqual(expect.objectContaining({ contentText: '' }));
    expect(response.documentId).toBe('drop-token-123');
  });

  it('rejects an anonymous WISP export before any tenant or ledger call', async () => {
    const authGuard = new AuthGuard(
      { send: jest.fn() } as any,
      new Reflector(),
      { verifyAsync: jest.fn() } as any,
      { send: jest.fn() } as any
    );
    const context = {
      getHandler: () => VaultController.prototype.exportWispComplianceAudit,
      getClass: () => VaultController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as any;

    await expect(authGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
    expect(financeClientMock.send).not.toHaveBeenCalled();
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('keeps staff routes authenticated and permission guarded', () => {
    const wispHandler = VaultController.prototype.getWispComplianceAudit;
    const exportHandler = VaultController.prototype.exportWispComplianceAudit;
    const copilotHandler = VaultController.prototype.copilotQuery;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, wispHandler)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, exportHandler)).toBeUndefined();
    expect(Reflect.getMetadata(PATH_METADATA, exportHandler)).toBe(
      'compliance/wisp/export'
    );
    expect(Reflect.getMetadata(METHOD_METADATA, exportHandler)).toBe(
      RequestMethod.GET
    );
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, copilotHandler)).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', wispHandler)).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(Reflect.getMetadata('__guards__', exportHandler)).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(Reflect.getMetadata('__guards__', copilotHandler)).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, wispHandler)?.permissions
    ).toEqual(['finance.tenant.manage']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, exportHandler)?.permissions
    ).toEqual(['finance.tenant.manage']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, copilotHandler)?.permissions
    ).toEqual(['finance.tenant.manage']);
  });

  it('derives the WISP tenant from the authenticated principal and ignores a query tenant', async () => {
    financeClientMock.send.mockReturnValue(of({ id: 'wirepro-cpa' }));
    complianceAuditClientMock.send.mockReturnValue(
      of({ records: [], chainValid: true, totalRecords: 0 })
    );

    await (controller as any).getWispComplianceAudit(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      '3',
      '25',
      'attacker-tenant'
    );

    expect(financeClientMock.send).toHaveBeenCalledWith(
      { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      }
    );
    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_GET_WISP_AUDIT,
      { tenantId: 'wirepro-cpa', page: 3, limit: 25 }
    );
  });

  it('overrides a caller-supplied copilot tenant with the authenticated tenant', async () => {
    financeClientMock.send.mockReturnValue(of({ id: 'wirepro-cpa' }));
    aiClientMock.send.mockReturnValue(
      of({ answer: 'Verified', model: 'local', sources: [], airGapped: true })
    );

    await (controller as any).copilotQuery(
      { user: { userId: 'user-1', profileId: 'profile-1' } },
      { query: 'Check tenant documents', tenantId: 'attacker-tenant' }
    );

    expect(aiClientMock.send).toHaveBeenCalledWith(
      COPILOT_QUERY_DOCUMENTS,
      expect.objectContaining({ tenantId: 'wirepro-cpa' })
    );
  });

  it('rejects an unknown document-drop token before auditing', async () => {
    await expect(
      controller.dropDocument(
        'unknown-token',
        {
          token: 'unknown-token',
          fileName: 'client.pdf',
          fileSizeBytes: 10,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('secret').toString('base64'),
        },
        { tenantId: 'wirepro-cpa', antivirusStatus: 'clean' }
      )
    ).rejects.toThrow();
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects escrow verification without an OTP before calling finance', async () => {
    await expect(
      controller.verifyEscrowOtp(
        escrowToken,
        { token: escrowToken, otpCode: '' },
        { tenantId: 'wirepro-cpa' }
      )
    ).rejects.toThrow();
    const escrowCalls = financeClientMock.send.mock.calls.filter(
      ([pattern]) => pattern === VAULT_VERIFY_ESCROW_OTP
    );
    expect(escrowCalls).toHaveLength(0);
  });

  it('rejects a replayed document-drop token without a second audit record', async () => {
    const dto = {
      token: dropToken,
      fileName: 'client.pdf',
      fileSizeBytes: 10,
      mimeType: 'application/pdf',
      fileBase64: Buffer.from('secret').toString('base64'),
    };
    const req = { tenantId: 'wirepro-cpa', antivirusStatus: 'clean' };

    await controller.dropDocument(dropToken, dto, req);
    complianceAuditClientMock.send.mockClear();

    await expect(controller.dropDocument(dropToken, dto, req)).rejects.toThrow(
      UnauthorizedException
    );
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects a revoked document-drop token without auditing', async () => {
    await vaultTokenService.revoke(dropToken);

    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: 'client.pdf',
          fileSizeBytes: 10,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('secret').toString('base64'),
        },
        { tenantId: 'wirepro-cpa', antivirusStatus: 'clean' }
      )
    ).rejects.toThrow(ForbiddenException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('rejects a document-drop token presented under another tenant context', async () => {
    await expect(
      controller.dropDocument(
        dropToken,
        {
          token: dropToken,
          fileName: 'client.pdf',
          fileSizeBytes: 10,
          mimeType: 'application/pdf',
          fileBase64: Buffer.from('secret').toString('base64'),
        },
        { tenantId: 'other-tenant', antivirusStatus: 'clean' }
      )
    ).rejects.toThrow(ForbiddenException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();
  });

  it('ignores a caller-supplied drop tenant and audits the token tenant', async () => {
    await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'client.pdf',
        fileSizeBytes: 10,
        mimeType: 'application/pdf',
        fileBase64: Buffer.from('secret').toString('base64'),
        tenantId: 'attacker-tenant',
      } as never,
      { antivirusStatus: 'clean' }
    );

    expect(complianceAuditClientMock.send).toHaveBeenCalledWith(
      VAULT_APPEND_AUDIT_EVENT,
      expect.objectContaining({ tenantId: 'wirepro-cpa' })
    );
  });

  it('keeps the escrow token usable after a failed finance verification', async () => {
    escrowVerifyImpl = () => throwError(() => new Error('finance down'));

    await expect(
      controller.verifyEscrowOtp(
        escrowToken,
        { token: escrowToken, otpCode: '123456' },
        { tenantId: 'wirepro-cpa' }
      )
    ).rejects.toThrow();

    escrowVerifyImpl = () => of({ accountNumber: '482910482910' });
    await expect(
      controller.verifyEscrowOtp(
        escrowToken,
        { token: escrowToken, otpCode: '123456' },
        { tenantId: 'wirepro-cpa' }
      )
    ).resolves.toBeDefined();
  });

  it('rejects a replayed escrow token after a successful verification', async () => {
    escrowVerifyImpl = () => of({ accountNumber: '482910482910' });
    const request = [
      escrowToken,
      { token: escrowToken, otpCode: '123456' },
      { tenantId: 'wirepro-cpa' },
    ] as const;

    await controller.verifyEscrowOtp(...request);
    await expect(controller.verifyEscrowOtp(...request)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('fails closed when the principal has no resolvable tenant', async () => {
    tenantResolveImpl = () =>
      throwError(() => ({ error: 'forbidden', statusCode: 403 }));

    await expect(
      (controller as any).getWispComplianceAudit({
        user: { userId: 'user-1', profileId: 'profile-1' },
      })
    ).rejects.toThrow(ForbiddenException);
    expect(complianceAuditClientMock.send).not.toHaveBeenCalled();

    await expect(
      (controller as any).copilotQuery(
        { user: { userId: 'user-1', profileId: 'profile-1' } },
        { query: 'anything' }
      )
    ).rejects.toThrow(ForbiddenException);
    expect(aiClientMock.send).not.toHaveBeenCalled();
  });

  it('never forwards the raw token outside the token lifecycle', async () => {
    complianceAuditClientMock.send.mockReturnValue(
      of(auditRecord({ documentId: 'drop-token-123' }))
    );
    escrowVerifyImpl = () => of({ accountNumber: '482910482910' });

    await controller.dropDocument(
      dropToken,
      {
        token: dropToken,
        fileName: 'client.pdf',
        fileSizeBytes: 10,
        mimeType: 'application/pdf',
        fileBase64: Buffer.from('secret').toString('base64'),
      },
      { tenantId: 'wirepro-cpa', antivirusStatus: 'clean' }
    );
    await controller.verifyEscrowOtp(
      escrowToken,
      { token: escrowToken, otpCode: '123456' },
      { tenantId: 'wirepro-cpa' }
    );

    const tokenLifecycle = financeClientMock.send.mock.calls.filter(
      ([pattern]) =>
        pattern === VAULT_VALIDATE_TOKEN ||
        pattern === VAULT_CONSUME_TOKEN ||
        pattern === VAULT_REVOKE_TOKEN
    );
    expect(tokenLifecycle.length).toBeGreaterThan(0);
    const elsewhere = JSON.stringify([
      complianceAuditClientMock.send.mock.calls,
      aiClientMock.send.mock.calls,
      financeClientMock.send.mock.calls.filter(
        ([pattern]) =>
          pattern !== VAULT_VALIDATE_TOKEN &&
          pattern !== VAULT_CONSUME_TOKEN &&
          pattern !== VAULT_REVOKE_TOKEN
      ),
    ]);
    expect(elsewhere).not.toContain(dropToken);
    expect(elsewhere).not.toContain(escrowToken);
  });

  it('registers an escrow for the principal tenant and returns the enrollment once', async () => {
    const enrolled = await controller.registerEscrow(
      { user: { userId: 'staff-1', profileId: 'profile-1' } },
      {
        token: 'closing-99',
        tenantId: 'attacker-tenant',
        beneficiary: 'Closing Trust',
        bankName: 'Bank',
        routingNumber: '061000104',
        accountNumber: '123456789',
        reference: 'REF-99',
      }
    );

    expect(financeClientMock.send).toHaveBeenCalledWith(
      VAULT_REGISTER_ESCROW,
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        token: 'closing-99',
      })
    );
    expect(enrolled.enrollmentUri).toContain('otpauth://totp/');
  });

  it('dispatches an SMS code only for a valid escrow token', async () => {
    const sent = await controller.requestEscrowSmsOtp(escrowToken, {
      token: escrowToken,
      phoneNumber: '+19125550100',
    });

    expect(sent).toEqual(
      expect.objectContaining({ sent: true, expiresAt: expect.any(String) })
    );
    expect(financeClientMock.send).toHaveBeenCalledWith(
      VAULT_REQUEST_WIRE_SMS_OTP,
      expect.objectContaining({
        token: 'escrow-42',
        tenantId: 'wirepro-cpa',
        phoneNumber: '+19125550100',
      })
    );
  });

  it('rejects SMS dispatch without a phone number', async () => {
    await expect(
      controller.requestEscrowSmsOtp(escrowToken, {
        token: escrowToken,
        phoneNumber: '  ',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects SMS dispatch for an unknown token', async () => {
    await expect(
      controller.requestEscrowSmsOtp('unknown-token', {
        token: 'unknown-token',
        phoneNumber: '+19125550100',
      })
    ).rejects.toThrow(UnauthorizedException);
  });

  it('reports the Twilio provider status to staff', async () => {
    const status = await controller.twilioStatus({
      user: { userId: 'staff-1', profileId: 'profile-1' },
    });

    expect(status).toEqual(
      expect.objectContaining({ configured: true, verified: true })
    );
  });

  it('issues and revokes vault tokens for staff', async () => {
    const issued = await controller.issueVaultToken(
      { user: { userId: 'staff-1', profileId: 'profile-1' } },
      {
        tenantId: 'attacker-tenant',
        documentId: 'drop-99',
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      }
    );

    expect(issued.token).toBeDefined();
    expect(financeClientMock.send).toHaveBeenCalledWith(
      VAULT_ISSUE_TOKEN,
      expect.objectContaining({ tenantId: 'wirepro-cpa' })
    );

    await expect(controller.revokeVaultToken({ token: '  ' })).rejects.toThrow(
      BadRequestException
    );
  });

  afterAll(() => {
    if (originalVaultTokenSecret === undefined) {
      delete process.env['VAULT_TOKEN_SECRET'];
    } else {
      process.env['VAULT_TOKEN_SECRET'] = originalVaultTokenSecret;
    }
  });
});
