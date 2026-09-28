import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { defer, from, Observable } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import * as crypto from 'crypto';
import {
  ComplianceAuditService,
  CreateAuditEntryInput,
} from './compliance-audit.service';
import {
  COMPLIANCE_AUDITED_KEY,
  ComplianceAuditedOptions,
} from './compliance-audited.decorator';

@Injectable()
export class ComplianceAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly auditService?: ComplianceAuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<ComplianceAuditedOptions>(
      COMPLIANCE_AUDITED_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!options) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const action = options.action || req?.method || 'DOCUMENT_ACCESS';
    const standard =
      options.complianceStandard ||
      'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557';

    return defer(() => next.handle()).pipe(
      catchError((error: unknown) =>
        from(this.recordFailureAndRethrow(req, error, action, standard))
      ),
      mergeMap((data) =>
        from(this.recordSuccess(req, data, action, standard)).pipe(
          map(() => data)
        )
      )
    );
  }

  private async recordSuccess(
    req: Record<string, any> | undefined,
    data: unknown,
    action: string,
    standard: string
  ): Promise<void> {
    await this.record(this.createEntry(req, action, standard, 'success', data));
  }

  private async recordFailure(
    req: Record<string, any> | undefined,
    error: unknown,
    action: string,
    standard: string
  ): Promise<void> {
    const status = this.getErrorStatus(error);
    const entry = this.createEntry(
      req,
      `${action}:FAILURE`,
      standard,
      'failure'
    );
    entry.metadata = {
      ...entry.metadata,
      statusCode: status,
    };
    await this.record(entry);
  }

  private async recordFailureAndRethrow(
    req: Record<string, any> | undefined,
    error: unknown,
    action: string,
    standard: string
  ): Promise<never> {
    await this.recordFailure(req, error, action, standard).catch(
      () => undefined
    );
    throw error;
  }

  private async record(entry: CreateAuditEntryInput): Promise<void> {
    if (!this.auditService) {
      throw new ServiceUnavailableException('Audit service is unavailable.');
    }
    await this.auditService.recordAudit(entry);
  }

  private createEntry(
    req: Record<string, any> | undefined,
    action: string,
    standard: string,
    outcome: 'success' | 'failure',
    data?: unknown
  ): CreateAuditEntryInput {
    return {
      tenantId: this.getTenantId(req),
      action,
      documentId: this.getDocumentId(req, data),
      fileName: this.getFileName(req, data),
      documentHash: this.getDocumentHash(req, data, outcome),
      antivirusStatus: this.getAntivirusStatus(req, data),
      complianceStandard: standard,
      metadata: this.createMetadata(req, data, outcome),
    };
  }

  private createMetadata(
    req: Record<string, any> | undefined,
    data: unknown,
    outcome: 'success' | 'failure'
  ): Record<string, unknown> {
    const response = this.getResponseRecord(data);
    const responseMetadata = this.getResponseRecord(response?.['metadata']);
    const requestMetadata = this.getResponseRecord(req?.['auditMetadata']);
    const metadata: Record<string, unknown> = {
      outcome,
      method: this.getMethod(req),
    };
    const actorId = this.getAuthenticatedActorId(req);
    const subjectId = this.firstMetadataValue([
      response?.['subjectId'],
      this.getIdentity(response?.['subject']),
      response?.['resourceId'],
      this.getIdentity(response?.['resource']),
      responseMetadata?.['subjectId'],
      req?.['subjectId'],
      this.getIdentity(req?.['subject']),
      req?.['resourceId'],
      this.getIdentity(req?.['resource']),
      requestMetadata?.['subjectId'],
      req?.['params']?.subjectId,
      req?.['body']?.subjectId,
    ]);
    metadata['actorId'] = actorId || 'anonymous';
    if (subjectId) {
      metadata['subjectId'] = subjectId;
    }
    return metadata;
  }

  private getAuthenticatedActorId(
    req: Record<string, any> | undefined
  ): string | undefined {
    const user = this.getResponseRecord(req?.['user']);
    return this.firstMetadataValue([
      user?.['userId'],
      user?.['profileId'],
      user?.['id'],
      user?.['sub'],
    ]);
  }

  private getIdentity(value: unknown): string | undefined {
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return this.firstMetadataValue([
        record['id'],
        record['userId'],
        record['actorId'],
        record['subjectId'],
      ]);
    }
    return this.normalizeMetadataValue(value);
  }

  private firstMetadataValue(values: unknown[]): string | undefined {
    for (const value of values) {
      const normalized = this.normalizeMetadataValue(value);
      if (normalized) {
        return normalized;
      }
    }
    return undefined;
  }

  private getDocumentId(
    req: Record<string, any> | undefined,
    data: unknown
  ): string {
    const response = this.getResponseRecord(data);
    const documentId =
      response?.['documentId'] ||
      response?.['id'] ||
      req?.['documentId'] ||
      req?.['params']?.documentId ||
      req?.['params']?.id ||
      req?.['body']?.documentId;
    return (
      this.normalizeMetadataValue(documentId) ||
      this.hashValue(
        `${this.getMethod(req)}:${this.getTenantId(req)}:${this.getRequestPath(
          req
        )}`
      )
    );
  }

  private getFileName(
    req: Record<string, any> | undefined,
    data: unknown
  ): string {
    const response = this.getResponseRecord(data);
    const fileName =
      response?.['fileName'] ||
      response?.['filename'] ||
      response?.['file_name'] ||
      req?.['file']?.originalname ||
      req?.['fileName'] ||
      req?.['body']?.fileName;
    return this.normalizeMetadataValue(fileName) || this.getRequestPath(req);
  }

  private getDocumentHash(
    req: Record<string, any> | undefined,
    data: unknown,
    outcome: string
  ): string {
    return this.hashRequest(req, data, outcome);
  }

  private getAntivirusStatus(
    req: Record<string, any> | undefined,
    data: unknown
  ): string {
    const requestStatus = this.normalizeMetadataValue(req?.['antivirusStatus']);
    if (requestStatus) {
      return requestStatus;
    }
    const response = this.getResponseRecord(data);
    return (
      this.normalizeMetadataValue(response?.['antivirusStatus']) ||
      'not_scanned'
    );
  }

  private hashRequest(
    req: Record<string, any> | undefined,
    data: unknown,
    outcome: string
  ): string {
    const requestBytes = this.getRequestBytes(req);
    if (requestBytes) {
      return this.hashBytes(requestBytes);
    }

    const responseBytes = this.getResponseBytes(data);
    if (responseBytes) {
      return this.hashBytes(responseBytes);
    }

    return this.hashValue(
      `${outcome}:${this.getMethod(req)}:${this.getTenantId(
        req
      )}:${this.getRequestPath(req)}`
    );
  }

  private getRequestBytes(
    req: Record<string, any> | undefined
  ): Buffer | undefined {
    const file = req?.['file'];
    const fileBuffer = this.toBuffer(file?.['buffer']) || this.toBuffer(file);
    if (fileBuffer) {
      return fileBuffer;
    }

    const body = req?.['body'];
    return (
      this.decodeBase64Bytes(body?.['fileBase64']) ||
      this.decodeBase64Bytes(req?.['fileBase64'])
    );
  }

  private getResponseBytes(data: unknown): Buffer | undefined {
    const directBytes = this.toBuffer(data);
    if (directBytes) {
      return directBytes;
    }
    if (typeof data === 'string') {
      return Buffer.from(data, 'utf8');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }

    const record = data as Record<string, unknown>;
    for (const key of [
      'buffer',
      'fileBuffer',
      'bytes',
      'content',
      'file',
      'body',
      'data',
    ]) {
      const bytes = this.toBuffer(record[key]);
      if (bytes) {
        return bytes;
      }
    }
    for (const key of ['fileBase64', 'base64', 'contentBase64', 'dataBase64']) {
      const bytes = this.decodeBase64Bytes(record[key]);
      if (bytes) {
        return bytes;
      }
    }
    return (
      this.getResponseBytes(record['file']) ||
      this.getResponseBytes(record['content']) ||
      this.getResponseBytes(record['data'])
    );
  }

  private toBuffer(value: unknown): Buffer | undefined {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return Buffer.from(value);
    }
    if (ArrayBuffer.isView(value)) {
      return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
    return undefined;
  }

  private decodeBase64Bytes(value: unknown): Buffer | undefined {
    return typeof value === 'string' && value.length > 0
      ? Buffer.from(value, 'base64')
      : undefined;
  }

  private hashBytes(value: Buffer): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private getResponseRecord(data: unknown): Record<string, any> | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }
    return data as Record<string, any>;
  }

  private normalizeMetadataValue(value: unknown): string | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = Array.from(value)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim();
    return normalized ? normalized.slice(0, 255) : undefined;
  }

  private getRequestPath(req: Record<string, any> | undefined): string {
    const path = req?.['path'] || req?.['originalUrl'] || req?.['url'];
    return typeof path === 'string' ? path.split(/[?#]/, 1)[0] : '';
  }

  private getTenantId(req: Record<string, any> | undefined): string {
    const tenantContext = this.getResponseRecord(req?.['tenantContext']);
    const guardTenantId = this.firstMetadataValue([
      tenantContext?.['tenantId'],
      req?.['tenantId'],
    ]);
    if (guardTenantId) {
      return guardTenantId;
    }

    return this.getAuthenticatedTenantId(req) || 'system';
  }

  private getAuthenticatedTenantId(
    req: Record<string, any> | undefined
  ): string | undefined {
    const user = this.getResponseRecord(req?.['user']);
    const tenant = this.getResponseRecord(user?.['tenant']);
    const userTenantContext = this.getResponseRecord(user?.['tenantContext']);
    return this.firstMetadataValue([
      user?.['tenantId'],
      tenant?.['tenantId'],
      tenant?.['id'],
      this.getIdentity(user?.['tenant']),
      userTenantContext?.['tenantId'],
    ]);
  }

  private getMethod(req: Record<string, any> | undefined): string {
    return typeof req?.['method'] === 'string' ? req['method'] : 'UNKNOWN';
  }

  private getErrorStatus(error: unknown): number | undefined {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
    ) {
      return (error as { status: number }).status;
    }
    return undefined;
  }
}
