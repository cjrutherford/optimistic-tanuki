import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LIFETIME = 7 * 24 * 60 * 60 * 1000;
export interface DeletionReceipt {
  v: 1;
  operationId: string;
  requestId: string;
  appId: 'client-interface' | 'local-hub';
  subject: string;
  expiresAt: number;
}
/** Status/retry only; never a session, owner grant, or authority to begin erasure. */
@Injectable()
export class AccountDeletionReceiptService {
  private readonly key: Buffer;
  constructor(config: ConfigService) {
    const secret = config.get<unknown>('auth.jwt_secret');
    if (
      typeof secret !== 'string' ||
      secret.length < 32 ||
      secret === 'default_jwt_secret'
    )
      throw Error('DELETION_RECEIPT_SECRET_REQUIRED');
    this.key = createHmac('sha256', secret)
      .update('ot-account-deletion-receipt-v1')
      .digest();
  }
  issue(
    accountId: string,
    appId: string,
    operationId: string,
    requestId: string
  ): string {
    if (
      !UUID.test(accountId) ||
      !UUID.test(operationId) ||
      !UUID.test(requestId) ||
      !['client-interface', 'local-hub'].includes(appId)
    )
      throw Error('DELETION_RECEIPT_INVALID');
    const value: DeletionReceipt = {
      v: 1,
      operationId,
      requestId,
      appId: appId as DeletionReceipt['appId'],
      subject: deletionIdentityKey('account', accountId),
      expiresAt: Date.now() + LIFETIME,
    };
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return payload + '.' + this.sign(payload);
  }
  verify(token: unknown, appId: unknown): Readonly<DeletionReceipt> {
    if (
      typeof token !== 'string' ||
      token.length > 2048 ||
      !['client-interface', 'local-hub'].includes(String(appId))
    )
      throw Error('DELETION_RECEIPT_INVALID');
    const parts = token.split('.');
    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]{1,1500}$/.test(parts[0]) ||
      !/^[0-9a-f]{64}$/.test(parts[1]) ||
      !timingSafeEqual(
        Buffer.from(parts[1], 'hex'),
        Buffer.from(this.sign(parts[0]), 'hex')
      )
    )
      throw Error('DELETION_RECEIPT_INVALID');
    let value: DeletionReceipt;
    try {
      value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      throw Error('DELETION_RECEIPT_INVALID');
    }
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'appId,expiresAt,operationId,requestId,subject,v' ||
      value.v !== 1 ||
      value.appId !== appId ||
      !UUID.test(value.operationId) ||
      !UUID.test(value.requestId) ||
      !/^[0-9a-f]{64}$/.test(value.subject) ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Date.now() ||
      value.expiresAt > Date.now() + LIFETIME + 30000
    )
      throw Error('DELETION_RECEIPT_INVALID');
    return Object.freeze({ ...value });
  }
  matchesAccount(value: DeletionReceipt, accountId: string): boolean {
    return (
      UUID.test(accountId) &&
      value.subject === deletionIdentityKey('account', accountId)
    );
  }
  private sign(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('hex');
  }
}
