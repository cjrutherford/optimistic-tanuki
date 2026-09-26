import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';

export const ENVELOPE_MAGIC = 'OTENV1:';
export const ENVELOPE_ALGORITHM = 'AES-256-GCM';
export const ENVELOPE_VERSION = 1;
export const VAULT_STORAGE_KEK_ENV = 'VAULT_STORAGE_KEK';
export const VAULT_STORAGE_KEK_ID_ENV = 'VAULT_STORAGE_KEK_ID';
export const DEK_BYTES = 32;
export const GCM_IV_BYTES = 12;
export const GCM_AUTH_TAG_BYTES = 16;

export interface EnvelopeHeader {
  alg: typeof ENVELOPE_ALGORITHM;
  v: typeof ENVELOPE_VERSION;
  kid: string;
  iv: string;
  tag: string;
  dek: string;
  dekIv: string;
  dekTag: string;
  aad?: string;
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

@Injectable()
export class EnvelopeEncryptionService {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly randomBytes: (size: number) => Buffer = (size) =>
      crypto.randomBytes(size)
  ) {}

  encrypt(plaintext: Buffer, associatedData?: string): Buffer {
    if (!Buffer.isBuffer(plaintext)) {
      throw new ServiceUnavailableException(
        'Vault storage envelope encryption requires a Buffer payload.'
      );
    }

    const kek = this.getKek();
    const dek = this.randomBytes(DEK_BYTES);
    const dekIv = this.randomBytes(GCM_IV_BYTES);
    const dataIv = this.randomBytes(GCM_IV_BYTES);

    const wrappingCipher = crypto.createCipheriv('aes-256-gcm', kek, dekIv);
    const wrappedDek = Buffer.concat([
      wrappingCipher.update(dek),
      wrappingCipher.final(),
    ]);
    const wrappingAuthTag = wrappingCipher.getAuthTag();

    const header: EnvelopeHeader = {
      alg: ENVELOPE_ALGORITHM,
      v: ENVELOPE_VERSION,
      kid: this.getKeyId(),
      iv: dataIv.toString('base64'),
      tag: '',
      dek: wrappedDek.toString('base64'),
      dekIv: dekIv.toString('base64'),
      dekTag: wrappingAuthTag.toString('base64'),
      ...(associatedData === undefined
        ? {}
        : { aad: Buffer.from(associatedData, 'utf8').toString('base64') }),
    };

    const dataCipher = crypto.createCipheriv('aes-256-gcm', dek, dataIv);
    dataCipher.setAAD(Buffer.from(canonicalAssociatedData(header), 'utf8'));

    let ciphertext: Buffer;
    let authTag: Buffer;
    try {
      ciphertext = Buffer.concat([
        dataCipher.update(plaintext),
        dataCipher.final(),
      ]);
      authTag = dataCipher.getAuthTag();
    } finally {
      dek.fill(0);
    }

    header.tag = authTag.toString('base64');

    return Buffer.concat([
      Buffer.from(`${ENVELOPE_MAGIC}${JSON.stringify(header)}\n`, 'utf8'),
      ciphertext,
    ]);
  }

  decrypt(container: Buffer): Buffer {
    if (!this.isEnvelope(container)) {
      throw new ServiceUnavailableException(
        'Stored object is not a vault storage envelope; refusing to return unauthenticated content.'
      );
    }

    const { header, ciphertext } = this.parseEnvelope(container);
    const kek = this.getKek();
    const dek = this.unwrapDek(header, kek);
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        dek,
        Buffer.from(header.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
      decipher.setAAD(Buffer.from(canonicalAssociatedData(header), 'utf8'));
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new ServiceUnavailableException(
        'Vault storage envelope failed AES-256-GCM authentication.'
      );
    } finally {
      dek.fill(0);
    }
  }

  isEnvelope(payload: Buffer | Uint8Array | null | undefined): boolean {
    if (!payload || payload.length <= ENVELOPE_MAGIC.length) {
      return false;
    }
    return (
      Buffer.from(payload.subarray(0, ENVELOPE_MAGIC.length)).toString(
        'utf8'
      ) === ENVELOPE_MAGIC
    );
  }

  parseEnvelope(container: Buffer): {
    header: EnvelopeHeader;
    ciphertext: Buffer;
  } {
    const newlineIndex = container.indexOf(0x0a);
    if (newlineIndex < 0) {
      throw new ServiceUnavailableException(
        'Vault storage envelope header is truncated.'
      );
    }

    const headerBytes = container.subarray(ENVELOPE_MAGIC.length, newlineIndex);
    let header: EnvelopeHeader;
    try {
      header = JSON.parse(headerBytes.toString('utf8')) as EnvelopeHeader;
    } catch {
      throw new ServiceUnavailableException(
        'Vault storage envelope header is not valid JSON.'
      );
    }

    if (
      !header ||
      header.alg !== ENVELOPE_ALGORITHM ||
      header.v !== ENVELOPE_VERSION ||
      typeof header.kid !== 'string' ||
      header.kid.length === 0
    ) {
      throw new ServiceUnavailableException(
        'Vault storage envelope header is missing a supported algorithm or key id.'
      );
    }

    this.assertBase64Length(header.iv, GCM_IV_BYTES, 'iv');
    this.assertBase64Length(header.tag, GCM_AUTH_TAG_BYTES, 'tag');
    this.assertBase64Length(header.dek, DEK_BYTES, 'dek');
    this.assertBase64Length(header.dekIv, GCM_IV_BYTES, 'dekIv');
    this.assertBase64Length(header.dekTag, GCM_AUTH_TAG_BYTES, 'dekTag');
    if (header.aad !== undefined) {
      this.assertBase64Length(header.aad, 1, 'aad', true);
    }

    return { header, ciphertext: container.subarray(newlineIndex + 1) };
  }

  readAssociatedData(container: Buffer): string | null {
    if (!this.isEnvelope(container)) {
      return null;
    }
    const { header } = this.parseEnvelope(container);
    return header.aad === undefined
      ? null
      : Buffer.from(header.aad, 'base64').toString('utf8');
  }

  getKeyId(): string {
    const configured = this.env[VAULT_STORAGE_KEK_ID_ENV];
    if (configured && configured.trim()) {
      return configured.trim();
    }
    return `kek-sha256-${crypto
      .createHash('sha256')
      .update(this.getKek())
      .digest('hex')
      .slice(0, 16)}`;
  }

  private unwrapDek(header: EnvelopeHeader, kek: Buffer): Buffer {
    let dek: Buffer;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        kek,
        Buffer.from(header.dekIv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(header.dekTag, 'base64'));
      dek = Buffer.concat([
        decipher.update(Buffer.from(header.dek, 'base64')),
        decipher.final(),
      ]);
    } catch {
      throw new ServiceUnavailableException(
        'Vault storage data key could not be unwrapped with the configured key encryption key.'
      );
    }

    if (dek.length !== DEK_BYTES) {
      dek.fill(0);
      throw new ServiceUnavailableException(
        'Vault storage data key has an unexpected length.'
      );
    }
    return dek;
  }

  private getKek(): Buffer {
    const secret = this.env[VAULT_STORAGE_KEK_ENV];
    if (!secret || !secret.trim()) {
      throw new ServiceUnavailableException(
        `${VAULT_STORAGE_KEK_ENV} is required for vault storage envelope encryption.`
      );
    }
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
  }

  private assertBase64Length(
    value: unknown,
    expectedBytes: number,
    field: string,
    minimum = false
  ): void {
    if (typeof value !== 'string' || !BASE64_PATTERN.test(value)) {
      throw new ServiceUnavailableException(
        `Vault storage envelope header field ${field} is not valid base64.`
      );
    }
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value) {
      throw new ServiceUnavailableException(
        `Vault storage envelope header field ${field} is not canonical base64.`
      );
    }
    if (
      minimum
        ? decoded.length < expectedBytes
        : decoded.length !== expectedBytes
    ) {
      throw new ServiceUnavailableException(
        `Vault storage envelope header field ${field} must ${
          minimum ? 'be at least' : 'decode to'
        } ${expectedBytes} bytes.`
      );
    }
  }
}

function canonicalAssociatedData(header: EnvelopeHeader): string {
  return [
    header.alg,
    String(header.v),
    header.kid,
    header.iv,
    header.dek,
    header.dekIv,
    header.dekTag,
    header.aad ?? '',
  ].join('|');
}
