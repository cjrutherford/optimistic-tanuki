import KeyGenerator from './generator';
import * as crypto from 'crypto';
import * as fs from 'fs';

jest.mock('crypto');
jest.mock('fs');

describe('KeyGenerator', () => {
  let keyGenerator: KeyGenerator;

  beforeEach(() => {
    keyGenerator = new KeyGenerator('/path/to/private/key');
  });

  it('should generate keys', () => {
    const generateKeyPairSync = jest.spyOn(crypto, 'generateKeyPairSync');
    generateKeyPairSync.mockReturnValue({ publicKey: 'publicKey' as any, privateKey: 'privateKey' as any });

    const writeFileSync = jest.spyOn(fs, 'writeFileSync');

    const result = keyGenerator.generateKeys();

    expect(generateKeyPairSync).toHaveBeenCalledWith('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    expect(writeFileSync).toHaveBeenCalledWith('/path/to/private/key', 'privateKey');
    expect(result).toEqual({ priv: '/path/to/private/key', pub: 'publicKey' });
  });

  it('should load private key', () => {
    const readFileSync = jest.spyOn(fs, 'readFileSync');
    readFileSync.mockReturnValue('privateKey');

    const result = keyGenerator.loadPrivateKey();

    expect(readFileSync).toHaveBeenCalledWith('/path/to/private/key', 'utf8');
    expect(result).toBe('privateKey');
  });
});
