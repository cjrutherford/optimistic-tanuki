import * as crypto from 'crypto';

import AsymmetricService from './asymmetric-key.service';

// Correctly mock the crypto module
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    generateKeyPair: jest.fn(actualCrypto.generateKeyPair),
    privateEncrypt: jest.fn(actualCrypto.privateEncrypt),
    publicDecrypt: jest.fn(actualCrypto.publicDecrypt),
  };
});

const mockedGenerateKeyPair = crypto.generateKeyPair as unknown as jest.Mock;
const mockedPrivateEncrypt = crypto.privateEncrypt as unknown as jest.Mock;
const mockedPublicDecrypt = crypto.publicDecrypt as unknown as jest.Mock;

describe('AsymmetricService', () => {
  let service: AsymmetricService;

  beforeEach(() => {
    service = new AsymmetricService();
    // Clear mocks before each test
    mockedGenerateKeyPair.mockClear();
    mockedPrivateEncrypt.mockClear();
    mockedPublicDecrypt.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKeyPair', () => {
    it('should generate a key pair successfully', async () => {
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----';
      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----';
      mockedGenerateKeyPair.mockImplementationOnce((type, options, callback) => {
        callback(null, mockPublicKey, mockPrivateKey);
      });

      const keys = await service.generateKeyPair();
      expect(keys).toEqual({ public: mockPublicKey, private: mockPrivateKey });
      expect(mockedGenerateKeyPair).toHaveBeenCalledWith(
        'rsa',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should generate a key pair with a secret', async () => {
      const mockPublicKey = '-----BEGIN PUBLIC KEY-----';
      const mockPrivateKey = '-----BEGIN PRIVATE KEY-----';
      mockedGenerateKeyPair.mockImplementationOnce((type, options, callback) => {
        callback(null, mockPublicKey, mockPrivateKey);
      });

      const secret = 'mysecret';
      const keys = await service.generateKeyPair(secret);
      expect(keys).toEqual({ public: mockPublicKey, private: mockPrivateKey });
      expect(mockedGenerateKeyPair).toHaveBeenCalledWith(
        'rsa',
        expect.objectContaining({
          privateKeyEncoding: expect.objectContaining({
            passphrase: secret,
          }),
        }),
        expect.any(Function),
      );
    });

    it('should reject if key generation fails', async () => {
      const mockError = new Error('Key generation failed');
      mockedGenerateKeyPair.mockImplementationOnce((type, options, callback) => {
        callback(mockError, null as any, null as any); // Pass null for keys in error case
      });

      await expect(service.generateKeyPair()).rejects.toThrow(mockError);
    });
  });

  describe('encrypt', () => {
    it('should encrypt data with a private key', () => {
      const privKey = '-----BEGIN PRIVATE KEY-----';
      const value = 'some data';
      const encryptedData = Buffer.from('encrypted');
      mockedPrivateEncrypt.mockReturnValue(encryptedData);

      const result = service.encrypt(privKey, value);
      expect(result).toEqual(encryptedData);
      expect(mockedPrivateEncrypt).toHaveBeenCalledWith(
        expect.objectContaining({ key: privKey, padding: crypto.constants.RSA_PKCS1_PADDING }),
        Buffer.from(value),
      );
    });

    it('should encrypt data with a private key and secret', () => {
      const privKey = '-----BEGIN PRIVATE KEY-----';
      const value = 'some data';
      const secret = 'mysecret';
      const encryptedData = Buffer.from('encrypted');
      mockedPrivateEncrypt.mockReturnValue(encryptedData);

      const result = service.encrypt(privKey, value, secret);
      expect(result).toEqual(encryptedData);
      expect(mockedPrivateEncrypt).toHaveBeenCalledWith(
        expect.objectContaining({ key: privKey, passphrase: secret, padding: crypto.constants.RSA_PKCS1_PADDING }),
        Buffer.from(value),
      );
    });
  });

  describe('decrypt', () => {
    it('should decrypt data with a public key', () => {
      const pubKey = '-----BEGIN PUBLIC KEY-----';
      const cyText = 'encrypted';
      const decryptedData = Buffer.from('decrypted');
      mockedPublicDecrypt.mockReturnValue(decryptedData);

      const result = service.decrypt(pubKey, cyText);
      expect(result).toEqual(decryptedData);
      expect(mockedPublicDecrypt).toHaveBeenCalledWith(
        expect.objectContaining({ key: pubKey, padding: crypto.constants.RSA_PKCS1_PADDING }),
        Buffer.from(cyText),
      );
    });

    it('should decrypt data with a public key and secret', () => {
      const pubKey = '-----BEGIN PUBLIC KEY-----';
      const cyText = 'encrypted';
      const secret = 'mysecret';
      const decryptedData = Buffer.from('decrypted');
      mockedPublicDecrypt.mockReturnValue(decryptedData);

      const result = service.decrypt(pubKey, cyText, secret);
      expect(result).toEqual(decryptedData);
      expect(mockedPublicDecrypt).toHaveBeenCalledWith(
        expect.objectContaining({ key: pubKey, passphrase: secret, padding: crypto.constants.RSA_PKCS1_PADDING }),
        Buffer.from(cyText),
      );
    });
  });
});