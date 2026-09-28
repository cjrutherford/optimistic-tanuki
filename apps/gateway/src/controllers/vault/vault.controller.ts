import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import {
  VAULT_VERIFY_ESCROW_OTP,
  VAULT_REGISTER_ESCROW,
  VAULT_REQUEST_WIRE_SMS_OTP,
  VAULT_VERIFY_TWILIO_PROVIDER,
  VAULT_GET_WISP_AUDIT,
  VAULT_APPEND_AUDIT_EVENT,
  VAULT_EXPORT_WISP_AUDIT,
  VAULT_INGEST_DOCUMENT,
  COPILOT_QUERY_DOCUMENTS,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  UploadDocumentDto,
  DocumentAuditResponseDto,
  WireVerificationRequestDto,
  WireInstructionResponseDto,
  CopilotQueryDto,
  CopilotResponseDto,
  RegisterEscrowInput,
  EscrowEnrollmentResult,
  TwilioProviderStatus,
  VaultTokenIssueInput,
  VaultTokenPurpose,
  WispAuditLogDto,
  ComplianceAuditExport,
  ComplianceAuditExportFormat,
  ComplianceAuditLogRecord,
} from '@optimistic-tanuki/models';
import {
  TimeLockedOtpService,
  AntivirusScanInterceptor,
  OptionalTenant,
} from '@optimistic-tanuki/business-security';
import { Public } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { TenantContextGuard } from '../../guards/tenant-context.guard';
import { UserDetails } from '../../decorators/user.decorator';
import {
  VAULT_STAFF_PERMISSION,
  VaultTenantResolver,
} from '../../security/vault-tenant-resolver.service';
import {
  VAULT_TOKEN_PURPOSES,
  VaultTokenService,
} from '../../security/vault-token.service';
import { extractVaultText } from './vault-text-extractor';

type VaultRequest = {
  user?: Pick<UserDetails, 'userId' | 'profileId'>;
  tenantId?: string;
  tenant?: { tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * The caller's own bearer token, taken from the request rather than from the
 * body.
 *
 * The copilot acts on an MCP session opened with this, and the tenant that
 * decides which documents it may read is derived from that session. Forwarding
 * the header is what makes the vault's tenant binding real rather than a field
 * the caller gets to fill in.
 */
const bearerToken = (req: VaultRequest | undefined): string | undefined => {
  const header =
    req?.headers?.['authorization'] ?? req?.headers?.['Authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(.+)$/i.exec(value?.trim() ?? '');
  return match?.[1]?.trim() || undefined;
};

@ApiTags('vault')
@ApiBearerAuth()
@Controller(['v1/vault', 'vault'])
export class VaultController {
  private readonly logger = new Logger(VaultController.name);

  constructor(
    @Inject(ServiceTokens.FINANCE_SERVICE)
    private readonly financeClient: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiClient: ClientProxy,
    @Inject(ServiceTokens.COMPLIANCE_AUDIT_SERVICE)
    private readonly complianceAuditClient: ClientProxy,
    private readonly otpService: TimeLockedOtpService,
    private readonly vaultTokenService: VaultTokenService,
    private readonly vaultTenantResolver: VaultTenantResolver
  ) {}

  @Public()
  @UseGuards(TenantContextGuard)
  @OptionalTenant()
  @Post('drop/:token')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AntivirusScanInterceptor)
  @ApiOperation({
    summary:
      'Upload confidential client document to Practice Vault with ClamAV scan and chained SHA-256 audit log',
  })
  @ApiResponse({
    status: 200,
    description: 'Document audited and sealed',
    type: DocumentAuditResponseDto,
  })
  async dropDocument(
    @Param('token') token: string,
    @Body() dto: UploadDocumentDto,
    @Req()
    req: VaultRequest & {
      file?: { originalname?: string; buffer?: Buffer };
      antivirusStatus?: string;
      ip?: string;
    }
  ): Promise<DocumentAuditResponseDto> {
    const effectiveToken = (token || dto.token)?.trim();
    if (!effectiveToken) {
      throw new BadRequestException('A vault drop token is required.');
    }

    const claims = await this.vaultTokenService.validate(
      effectiveToken,
      VAULT_TOKEN_PURPOSES.DOCUMENT_DROP
    );
    const requestTenantId = req?.tenantId || req?.tenant?.tenantId;
    if (requestTenantId && requestTenantId !== claims.tenantId) {
      throw new ForbiddenException(
        'Vault token does not match the resolved tenant context.'
      );
    }

    const tenantId = claims.tenantId;
    const fileName = (dto.fileName || req?.file?.originalname)?.trim();
    if (!fileName) {
      throw new BadRequestException('A document file name is required.');
    }

    let fileBuffer: Buffer | undefined;
    if (dto.fileBase64) {
      fileBuffer = Buffer.from(dto.fileBase64, 'base64');
    } else if (req?.file?.buffer) {
      fileBuffer = req.file.buffer;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('A document file is required.');
    }

    const documentHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');
    const antivirusStatus = req?.antivirusStatus;
    if (antivirusStatus !== 'clean') {
      throw new ServiceUnavailableException(
        'A verified clean antivirus scan result is required.'
      );
    }

    const consumedClaims = await this.vaultTokenService.consume(
      effectiveToken,
      VAULT_TOKEN_PURPOSES.DOCUMENT_DROP
    );
    const auditRecord = await firstValueFrom(
      this.complianceAuditClient.send<ComplianceAuditLogRecord>(
        VAULT_APPEND_AUDIT_EVENT,
        {
          tenantId,
          action: 'PRACTICE_VAULT_DOCUMENT_UPLOAD',
          documentId: consumedClaims.documentId,
          fileName,
          documentHash,
          antivirusStatus,
          complianceStandard:
            'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557',
          metadata: {
            tokenId: consumedClaims.jti,
            fileSizeBytes: dto.fileSizeBytes || fileBuffer.length,
            retentionPolicy:
              dto.retentionPolicy || '7-year statutory retention',
            ip: req?.ip,
          },
        }
      )
    );

    // The bytes are kept so the copilot has something to read. The upload used
    // to be hashed, sealed, and discarded, which left the vault unable to
    // answer a question about a document it already held.
    //
    // A format with no readable text stores an empty string rather than failing
    // the drop: the chain is already sealed and the bytes are not lost, so
    // refusing here would take away an audit record over a parsing problem.
    // Retrieval reports such a document as having no readable text, which is
    // the truth, and the copilot refuses to answer from it.
    const extraction = await extractVaultText(fileBuffer, fileName);
    try {
      await firstValueFrom(
        this.complianceAuditClient.send(VAULT_INGEST_DOCUMENT, {
          tenantId,
          documentId: consumedClaims.documentId,
          fileName,
          mimeType: dto.mimeType,
          documentHash,
          contentText: extraction.text,
        })
      );
    } catch (error) {
      this.logger.error(
        `Stored text for document ${consumedClaims.documentId} could not be persisted: ${error}`
      );
    }
    if (!extraction.extracted) {
      this.logger.warn(
        `Document ${consumedClaims.documentId} (${fileName}) was sealed with no readable text: ${extraction.reason}`
      );
    }

    this.logger.log(
      `Audited upload for document ${
        consumedClaims.documentId
      }. Chained hash: ${auditRecord.chainedHash.substring(0, 12)}...`
    );

    return {
      id: auditRecord.id,
      tenantId: auditRecord.tenantId,
      documentId: auditRecord.documentId,
      fileName: auditRecord.fileName,
      documentHash: auditRecord.documentHash,
      previousHash: auditRecord.previousHash,
      chainedHash: auditRecord.chainedHash,
      antivirusStatus,
      complianceStandard: auditRecord.complianceStandard,
      wispCompliant: antivirusStatus === 'clean',
      timestamp: auditRecord.timestamp,
      scannedAt: auditRecord.timestamp,
    };
  }

  /** Body-token variant, kept separate so OpenAPI does not declare a token
   * path parameter on `/drop`. */
  @Public()
  @UseGuards(TenantContextGuard)
  @OptionalTenant()
  @Post('drop')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AntivirusScanInterceptor)
  @ApiOperation({
    summary:
      'Upload confidential client document to Practice Vault with ClamAV scan and chained SHA-256 audit log',
  })
  @ApiResponse({
    status: 200,
    description: 'Document audited and sealed',
    type: DocumentAuditResponseDto,
  })
  async dropDocumentWithBodyToken(
    @Body() dto: UploadDocumentDto,
    @Req()
    req: VaultRequest & {
      file?: { originalname?: string; buffer?: Buffer };
      antivirusStatus?: string;
      ip?: string;
    }
  ): Promise<DocumentAuditResponseDto> {
    return this.dropDocument('', dto, req);
  }

  @Public()
  @UseGuards(TenantContextGuard)
  @OptionalTenant()
  @Post('escrow-verify/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify 6-digit rolling TOTP and decrypt escrow wire instructions under ALTA Pillar 3',
  })
  @ApiResponse({
    status: 200,
    description: 'Decrypted wire instructions',
    type: WireInstructionResponseDto,
  })
  async verifyEscrowOtp(
    @Param('token') token: string,
    @Body() dto: WireVerificationRequestDto,
    @Req() req: VaultRequest
  ): Promise<WireInstructionResponseDto> {
    const effectiveToken = (token || dto.token)?.trim();
    if (!effectiveToken) {
      throw new BadRequestException(
        'An escrow verification token is required.'
      );
    }

    const claims = await this.vaultTokenService.validate(
      effectiveToken,
      VAULT_TOKEN_PURPOSES.ESCROW_WIRE
    );
    const requestTenantId = req?.tenantId || req?.tenant?.tenantId;
    if (requestTenantId && requestTenantId !== claims.tenantId) {
      throw new ForbiddenException(
        'Vault token does not match the resolved tenant context.'
      );
    }

    const otpCode = dto.otpCode?.trim();
    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      throw new UnauthorizedException(
        'A valid six-digit rolling TOTP is required for escrow access.'
      );
    }

    const verificationPayload: WireVerificationRequestDto = {
      token: claims.documentId,
      otpCode,
      tenantId: claims.tenantId,
    };

    this.logger.log(`Verifying rolling TOTP for document ${claims.documentId}`);
    const wire = await firstValueFrom(
      this.financeClient.send<WireInstructionResponseDto>(
        VAULT_VERIFY_ESCROW_OTP,
        verificationPayload
      )
    );
    if (!wire) {
      throw new ServiceUnavailableException(
        'Escrow verification did not return wire instructions.'
      );
    }

    await this.vaultTokenService.consume(
      effectiveToken,
      VAULT_TOKEN_PURPOSES.ESCROW_WIRE
    );
    return wire;
  }

  /** Body-token variant, kept separate so OpenAPI does not declare a token
   * path parameter on `/escrow-verify`. */
  @Public()
  @UseGuards(TenantContextGuard)
  @OptionalTenant()
  @Post('escrow-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify 6-digit rolling TOTP and decrypt escrow wire instructions under ALTA Pillar 3',
  })
  @ApiResponse({
    status: 200,
    description: 'Decrypted wire instructions',
    type: WireInstructionResponseDto,
  })
  async verifyEscrowOtpWithBodyToken(
    @Body() dto: WireVerificationRequestDto,
    @Req() req: VaultRequest
  ): Promise<WireInstructionResponseDto> {
    return this.verifyEscrowOtp('', dto, req);
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Post('escrow/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Register an escrow wire record and return the authenticator enrollment exactly once',
  })
  async registerEscrow(
    @Req() req: VaultRequest,
    @Body() dto: RegisterEscrowInput
  ): Promise<EscrowEnrollmentResult> {
    const tenantId = await this.vaultTenantResolver.resolve(req?.user);
    this.logger.log(`Registering escrow wire record for tenant ${tenantId}.`);
    const enrolled = await firstValueFrom(
      this.financeClient.send<EscrowEnrollmentResult>(VAULT_REGISTER_ESCROW, {
        ...(dto ?? {}),
        tenantId,
      })
    );
    if (!enrolled || typeof enrolled.enrollmentUri !== 'string') {
      throw new ServiceUnavailableException(
        'Escrow registration did not return an enrollment.'
      );
    }
    return enrolled;
  }

  @Public()
  @Post('escrow-verify/:token/sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Request a one-time SMS code for a valid escrow verification token',
  })
  async requestEscrowSmsOtp(
    @Param('token') token: string,
    @Body() dto: { token?: string; phoneNumber?: string }
  ): Promise<{ sent: true; expiresAt: string }> {
    const effectiveToken = (token || dto?.token)?.trim();
    if (!effectiveToken) {
      throw new BadRequestException(
        'An escrow verification token is required.'
      );
    }
    const claims = await this.vaultTokenService.validate(
      effectiveToken,
      VAULT_TOKEN_PURPOSES.ESCROW_WIRE
    );
    const phoneNumber = dto?.phoneNumber?.trim();
    if (!phoneNumber) {
      throw new BadRequestException('A destination phone number is required.');
    }
    const issued = await firstValueFrom(
      this.financeClient.send<{ expiresAt: string; messageId: string }>(
        VAULT_REQUEST_WIRE_SMS_OTP,
        {
          token: claims.documentId,
          tenantId: claims.tenantId,
          phoneNumber,
          validitySeconds: 90,
        }
      )
    );
    if (!issued || typeof issued.messageId !== 'string') {
      throw new ServiceUnavailableException(
        'The SMS code could not be dispatched.'
      );
    }
    return { sent: true, expiresAt: issued.expiresAt };
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Get('notifications/twilio-status')
  @ApiOperation({
    summary: 'Verify the Twilio provider credentials without sending an SMS',
  })
  async twilioStatus(@Req() req: VaultRequest): Promise<TwilioProviderStatus> {
    await this.vaultTenantResolver.resolve(req?.user);
    return firstValueFrom(
      this.financeClient.send<TwilioProviderStatus>(
        VAULT_VERIFY_TWILIO_PROVIDER,
        {}
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Get('compliance/wisp')
  @ApiOperation({
    summary:
      'Retrieve immutable WISP compliance audit ledger with chained SHA-256 verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Cryptographically verified WISP audit log',
    type: WispAuditLogDto,
  })
  async getWispComplianceAudit(
    @Req() req: VaultRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<WispAuditLogDto> {
    const tenantId = await this.vaultTenantResolver.resolve(req?.user);
    this.logger.log(`Retrieving WISP compliance logs for tenant ${tenantId}`);
    return firstValueFrom(
      this.complianceAuditClient.send<WispAuditLogDto>(VAULT_GET_WISP_AUDIT, {
        tenantId,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Get('compliance/wisp/export')
  @ApiOperation({
    summary:
      'Export the tenant WISP compliance audit chain for regulatory review',
  })
  @ApiResponse({
    status: 200,
    description: 'WISP audit chain export with integrity evidence',
  })
  async exportWispComplianceAudit(
    @Req() req: VaultRequest,
    @Query('format') format: string | undefined,
    @Res() response: Response
  ): Promise<void> {
    const exportFormat = this.normalizeExportFormat(format);
    const tenantId = await this.vaultTenantResolver.resolve(req?.user);
    this.logger.log(
      `Retrieving ${exportFormat} WISP compliance export for tenant ${tenantId}`
    );
    const exported = await firstValueFrom(
      this.complianceAuditClient.send<ComplianceAuditExport>(
        VAULT_EXPORT_WISP_AUDIT,
        {
          tenantId,
          format: exportFormat,
        }
      )
    );
    if (
      !exported ||
      typeof exported.content !== 'string' ||
      !Array.isArray(exported.records)
    ) {
      throw new ServiceUnavailableException(
        'The WISP compliance export is unavailable.'
      );
    }
    if (
      exported.tenantId !== tenantId ||
      (Array.isArray(exported.records) &&
        exported.records.some(
          (record) => !record || record.tenantId !== tenantId
        ))
    ) {
      throw new ForbiddenException(
        'The export tenant did not match the authenticated tenant.'
      );
    }

    const body = Buffer.from(exported.content, 'utf8');
    response.setHeader(
      'Content-Type',
      exportFormat === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8'
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.safeExportFilename(
        exported.filename,
        exportFormat
      )}"`
    );
    response.setHeader('Content-Length', body.byteLength);
    response.setHeader('Cache-Control', 'no-store');
    response.send(body);
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Post('copilot/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confidential air-gapped indexing and transcript query via on-premises Ollama / MCP',
  })
  @ApiResponse({
    status: 200,
    description: 'Air-gapped response with citations',
    type: CopilotResponseDto,
  })
  async copilotQuery(
    @Req() req: VaultRequest,
    @Body() dto: CopilotQueryDto
  ): Promise<CopilotResponseDto> {
    const tenantId = await this.vaultTenantResolver.resolve(req?.user);
    this.logger.log(
      `Dispatching a confidential document query for tenant ${tenantId}`
    );
    return firstValueFrom(
      this.aiClient.send<CopilotResponseDto>(COPILOT_QUERY_DOCUMENTS, {
        ...dto,
        tenantId,
        // Set after the spread, so a client that put its own credential in the
        // body has it replaced by the one it actually authenticated with.
        accessToken: bearerToken(req),
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Post('tokens/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a single-use vault magic-link token for a tenant document',
  })
  async issueVaultToken(
    @Req() req: VaultRequest,
    @Body() dto: VaultTokenIssueInput & { purpose: VaultTokenPurpose }
  ): Promise<{ token: string }> {
    const tenantId = await this.vaultTenantResolver.resolve(req?.user);
    const purpose = dto?.purpose;
    if (
      purpose !== VAULT_TOKEN_PURPOSES.DOCUMENT_DROP &&
      purpose !== VAULT_TOKEN_PURPOSES.ESCROW_WIRE
    ) {
      throw new BadRequestException('A valid vault token purpose is required.');
    }
    const documentId = dto?.documentId?.trim();
    if (!documentId) {
      throw new BadRequestException('A vault document id is required.');
    }
    const token = await this.vaultTokenService.issue({
      tenantId,
      documentId,
      purpose,
      expiresInSeconds: dto?.expiresInSeconds,
      issuedBy: req?.user?.userId,
    });
    this.logger.log(`Issued ${purpose} vault token for tenant ${tenantId}.`);
    return { token };
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(VAULT_STAFF_PERMISSION)
  @Post('tokens/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a vault magic-link token before it is consumed',
  })
  async revokeVaultToken(
    @Body() dto: { token?: string }
  ): Promise<{ revoked: true }> {
    const rawToken = dto?.token?.trim();
    if (!rawToken) {
      throw new BadRequestException('A vault token is required.');
    }
    await this.vaultTokenService.revoke(rawToken);
    return { revoked: true };
  }

  private normalizeExportFormat(
    format: string | undefined
  ): ComplianceAuditExportFormat {
    if (format === undefined || format === '') {
      return 'csv';
    }
    if (format !== 'csv' && format !== 'json') {
      throw new BadRequestException('format must be csv or json');
    }
    return format;
  }

  private safeExportFilename(
    filename: unknown,
    format: ComplianceAuditExportFormat
  ): string {
    const fallback = `wisp-compliance-audit-export.${format}`;
    if (typeof filename !== 'string') {
      return fallback;
    }
    const safe = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .replace(/\.[^.]*$/, '');
    return `${safe || 'wisp-compliance-audit-export'}.${format}`;
  }
}
