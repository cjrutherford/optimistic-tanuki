import { ServiceUnavailableException } from '@nestjs/common';

import {
  DEK_BYTES,
  ENVELOPE_ALGORITHM,
  ENVELOPE_MAGIC,
  ENVELOPE_VERSION,
  EnvelopeEncryptionService,
  VAULT_STORAGE_KEK_ENV,
} from './envelope-encryption.service';

const KEK = 'primary-practice-vault-kek';

function serviceWith(
  env: NodeJS.ProcessEnv,
  randomBytes?: (size: number) => Buffer
): EnvelopeEncryptionService {
  return new EnvelopeEncryptionService(env, randomBytes);
}

function rewriteHeader(
  container: Buffer,
  mutate: (header: Record<string, unknown>) => void
): Buffer {
  const newlineIndex = container.indexOf(0x0a);
  const header = JSON.parse(
    container.subarray(ENVELOPE_MAGIC.length, newlineIndex).toString('utf8')
  ) as Record<string, unknown>;
  mutate(header);
  return Buffer.concat([
    Buffer.from(`${ENVELOPE_MAGIC}${JSON.stringify(header)}\n`, 'utf8'),
    container.subarray(newlineIndex + 1),
  ]);
}

describe('EnvelopeEncryptionService', () => {
  const service = serviceWith({ [VAULT_STORAGE_KEK_ENV]: KEK });

  describe('round trip', () => {
    it('restores the exact plaintext bytes', () => {
      const plaintext = Buffer.from(
        'Form 1040 U.S. Individual Income Tax Return — SSN 000-00-0000',
        'utf8'
      );

      const envelope = service.encrypt(plaintext);

      expect(service.isEnvelope(envelope)).toBe(true);
      expect(envelope.equals(plaintext)).toBe(false);
      expect(service.decrypt(envelope).equals(plaintext)).toBe(true);
    });

    it('round trips binary payloads including zero bytes', () => {
      const plaintext = Buffer.from([0, 1, 2, 250, 251, 255, 0, 128]);

      const envelope = service.encrypt(plaintext);

      expect(service.decrypt(envelope).equals(plaintext)).toBe(true);
    });

    it('round trips an empty payload', () => {
      const envelope = service.encrypt(Buffer.alloc(0));

      expect(service.decrypt(envelope).equals(Buffer.alloc(0))).toBe(true);
    });

    it('uses a fresh data key and fresh ivs for every object', () => {
      const first = service.encrypt(Buffer.from('identical tax return'));
      const second = service.encrypt(Buffer.from('identical tax return'));

      const firstHeader = service.parseEnvelope(first).header;
      const secondHeader = service.parseEnvelope(second).header;

      expect(firstHeader.iv).not.toBe(secondHeader.iv);
      expect(firstHeader.dekIv).not.toBe(secondHeader.dekIv);
      expect(firstHeader.dek).not.toBe(secondHeader.dek);
      expect(first.equals(second)).toBe(false);
    });

    it('carries the algorithm, version, key id, iv, tag and wrapped key in the header', () => {
      const envelope = service.encrypt(Buffer.from('document'), 'ctx');

      const { header } = service.parseEnvelope(envelope);

      expect(header.alg).toBe(ENVELOPE_ALGORITHM);
      expect(header.v).toBe(ENVELOPE_VERSION);
      expect(header.kid).toMatch(/^kek-sha256-[0-9a-f]{16}$/);
      expect(Buffer.from(header.iv, 'base64')).toHaveLength(12);
      expect(Buffer.from(header.tag, 'base64')).toHaveLength(16);
      expect(Buffer.from(header.dek, 'base64')).toHaveLength(DEK_BYTES);
      expect(Buffer.from(header.dekIv, 'base64')).toHaveLength(12);
      expect(Buffer.from(header.dekTag, 'base64')).toHaveLength(16);
      expect(service.readAssociatedData(envelope)).toBe('ctx');
    });

    it('never stores the data key in the clear', () => {
      const envelope = service.encrypt(Buffer.from('payroll register'));

      const { header } = service.parseEnvelope(envelope);
      const wrapped = Buffer.from(header.dek, 'base64');

      expect(wrapped.equals(wrapped)).toBe(true);
      expect(envelope.includes(Buffer.from('payroll register'))).toBe(false);
      expect(
        service.decrypt(envelope).equals(Buffer.from('payroll register'))
      ).toBe(true);
    });

    it('honours an explicitly configured key id', () => {
      const named = serviceWith({
        [VAULT_STORAGE_KEK_ENV]: KEK,
        VAULT_STORAGE_KEK_ID: 'kek-2026-primary',
      });

      const { header } = named.parseEnvelope(named.encrypt(Buffer.from('x')));

      expect(header.kid).toBe('kek-2026-primary');
    });
  });

  describe('fail closed on key configuration', () => {
    it.each([['missing'], ['empty'], ['whitespace']])(
      'refuses to encrypt when the key encryption key is %s',
      (shape) => {
        const env: NodeJS.ProcessEnv =
          shape === 'missing'
            ? {}
            : shape === 'empty'
            ? { [VAULT_STORAGE_KEK_ENV]: '' }
            : { [VAULT_STORAGE_KEK_ENV]: '   ' };

        const unconfigured = serviceWith(env);

        expect(() => unconfigured.encrypt(Buffer.from('tax return'))).toThrow(
          ServiceUnavailableException
        );
        expect(() => unconfigured.encrypt(Buffer.from('tax return'))).toThrow(
          `${VAULT_STORAGE_KEK_ENV} is required`
        );
      }
    );

    it('refuses to decrypt when the key encryption key is missing', () => {
      const sealed = service.encrypt(Buffer.from('tax return'));

      expect(() => serviceWith({}).decrypt(sealed)).toThrow(
        ServiceUnavailableException
      );
    });

    it('refuses to unwrap a data key sealed under a different key', () => {
      const sealed = service.encrypt(Buffer.from('tax return'));
      const wrongKek = serviceWith({
        [VAULT_STORAGE_KEK_ENV]: 'some-other-practice-kek',
      });

      expect(() => wrongKek.decrypt(sealed)).toThrow(
        ServiceUnavailableException
      );
      expect(() => wrongKek.decrypt(sealed)).toThrow(
        'could not be unwrapped with the configured key encryption key'
      );
    });

    it('rejects a payload that is not an envelope instead of returning it as-is', () => {
      expect(() => service.decrypt(Buffer.from('plaintext on disk'))).toThrow(
        ServiceUnavailableException
      );
      expect(() => service.decrypt(Buffer.from('plaintext on disk'))).toThrow(
        'refusing to return unauthenticated content'
      );
    });

    it('rejects a buffer too small to hold an envelope header', () => {
      expect(service.isEnvelope(Buffer.alloc(0))).toBe(false);
      expect(() => service.decrypt(Buffer.alloc(2))).toThrow();
    });
  });

  describe('tamper detection', () => {
    it('rejects a flipped ciphertext byte', () => {
      const envelope = service.encrypt(Buffer.from('account 12345678'));

      const tampered = Buffer.from(envelope);
      const ciphertextStart = envelope.indexOf(0x0a) + 1;
      tampered[ciphertextStart] ^= 0xff;

      expect(() => service.decrypt(tampered)).toThrow(
        ServiceUnavailableException
      );
      expect(() => service.decrypt(tampered)).toThrow('failed AES-256-GCM');
    });

    it('rejects a tampered authentication tag', () => {
      const envelope = service.encrypt(Buffer.from('account 12345678'));
      const header = service.parseEnvelope(envelope).header;
      const flipped = Buffer.from(header.tag, 'base64');
      flipped[0] ^= 0x01;

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed['tag'] = flipped.toString('base64');
      });

      expect(() => service.decrypt(tampered)).toThrow('failed AES-256-GCM');
    });

    it('rejects a swapped data key and therefore the wrong plaintext', () => {
      const first = service.encrypt(Buffer.from('first tax return'));
      const second = service.encrypt(Buffer.from('second tax return'));

      const spliced = rewriteHeader(first, (parsed) => {
        parsed['dek'] = service.parseEnvelope(second).header.dek;
        parsed['dekIv'] = service.parseEnvelope(second).header.dekIv;
        parsed['dekTag'] = service.parseEnvelope(second).header.dekTag;
      });

      expect(() => service.decrypt(spliced)).toThrow(
        ServiceUnavailableException
      );
    });

    it('rejects a rewritten key id because the header is authenticated data', () => {
      const envelope = service.encrypt(Buffer.from('tax return'));

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed['kid'] = 'kek-sha256-0000000000000000';
      });

      expect(() => service.decrypt(tampered)).toThrow('failed AES-256-GCM');
    });

    it('rejects rewritten associated data', () => {
      const envelope = service.encrypt(Buffer.from('tax return'), 'FORM_1040');

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed['aad'] = Buffer.from('STANDARD', 'utf8').toString('base64');
      });

      expect(() => service.decrypt(tampered)).toThrow('failed AES-256-GCM');
    });

    it('rejects a truncated header', () => {
      const envelope = service.encrypt(Buffer.from('tax return'));

      expect(() =>
        service.decrypt(
          Buffer.from(envelope.subarray(0, ENVELOPE_MAGIC.length + 4))
        )
      ).toThrow(ServiceUnavailableException);
    });

    it('rejects a header that is not valid json', () => {
      const envelope = service.encrypt(Buffer.from('tax return'));
      const newlineIndex = envelope.indexOf(0x0a);

      const tampered = Buffer.concat([
        Buffer.from(`${ENVELOPE_MAGIC}{not json}\n`, 'utf8'),
        envelope.subarray(newlineIndex + 1),
      ]);

      expect(() => service.decrypt(tampered)).toThrow(
        'header is not valid JSON'
      );
    });

    it.each([
      ['alg', 'AES-128-CBC'],
      ['v', 2],
    ])('rejects a header whose %s is unsupported', (field, value) => {
      const envelope = service.encrypt(Buffer.from('tax return'));

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed[field] = value;
      });

      expect(() => service.decrypt(tampered)).toThrow(
        'missing a supported algorithm or key id'
      );
    });

    it.each([
      ['iv', 'c2hvcnQ='],
      ['tag', 'c2hvcnQ='],
      ['dek', 'c2hvcnQ='],
      ['dekIv', 'c2hvcnQ='],
      ['dekTag', 'c2hvcnQ='],
    ])('rejects a header whose %s has the wrong length', (field, value) => {
      const envelope = service.encrypt(Buffer.from('tax return'));

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed[field] = value;
      });

      expect(() => service.decrypt(tampered)).toThrow(
        /must decode to \d+ bytes/
      );
    });

    it('rejects a header whose field is not base64', () => {
      const envelope = service.encrypt(Buffer.from('tax return'));

      const tampered = rewriteHeader(envelope, (parsed) => {
        parsed['iv'] = 'not base64!!';
      });

      expect(() => service.decrypt(tampered)).toThrow('is not valid base64');
    });
  });

  it('refuses to encrypt a non-buffer payload', () => {
    expect(() => service.encrypt('string' as unknown as Buffer)).toThrow(
      ServiceUnavailableException
    );
  });

  it('uses the injected randomness source for the data key and both ivs', () => {
    const calls: number[] = [];
    const deterministic = serviceWith(
      { [VAULT_STORAGE_KEK_ENV]: KEK },
      (size) => {
        calls.push(size);
        return Buffer.alloc(size, calls.length);
      }
    );

    const envelope = deterministic.encrypt(Buffer.from('tax return'));

    expect(calls).toEqual([32, 12, 12]);
    expect(deterministic.decrypt(envelope).toString()).toBe('tax return');
  });
});
