import { SaltedHashService, SaltHash } from './salt-hash.service';
import { createHmac, randomBytes } from 'crypto';

// Mock the crypto functions
jest.mock('crypto', () => {
  const originalCrypto = jest.requireActual('crypto');
  return {
    ...originalCrypto,
    createHmac: jest.fn((algorithm, key) => {
      const hmac = originalCrypto.createHmac(algorithm, key);
      const originalUpdate = hmac.update;
      const originalDigest = hmac.digest;

      // Mock the update and digest methods to control their behavior
      hmac.update = jest.fn((data) => {
        return originalUpdate.call(hmac, data);
      });
      hmac.digest = jest.fn((encoding) => {
        return originalDigest.call(hmac, encoding);
      });
      return hmac;
    }),
    randomBytes: jest.fn(() => ({
      toString: jest.fn(() => 'randomSalt'),
    })),
  };
});

describe('SaltedHashService', () => {
  let service: SaltedHashService;

  beforeEach(() => {
    service = new SaltedHashService();
    (createHmac as jest.Mock).mockClear();
    (randomBytes as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNewHash', () => {
    it('should create a new salted hash', () => {
      const password = 'myPassword';
      const expectedSalt = 'randomSalt';

      const result: SaltHash = service.createNewHash(password);

      expect(randomBytes).toHaveBeenCalledWith(64);
      expect(createHmac).toHaveBeenCalledWith('sha512', expectedSalt);
      // Since we are using the actual crypto.createHmac, the hash will be real
      // We can't hardcode the expected hash unless we also mock the internal behavior of createHmac precisely.
      // Instead, we'll check the structure and that it's not empty.
      expect(result.salt).toEqual(expectedSalt);
      expect(typeof result.hash).toBe('string');
      expect(result.hash.length).toBeGreaterThan(0);
    });
  });

  describe('validateHash', () => {
    it('should return true for a valid hash', () => {
      const challenge = 'myPassword';
      const salt = 'randomSalt';
      // Generate a real hash to test against
      const hmac = createHmac('sha512', salt);
      hmac.update(challenge);
      const testHash = hmac.digest('hex');

      const result = service.validateHash(challenge, testHash, salt);

      expect(result).toBe(true);
    });

    it('should return false for an invalid hash', () => {
      const challenge = 'wrongPassword';
      const salt = 'randomSalt';
      // Generate a real hash for a different password to ensure it doesn't match
      const hmac = createHmac('sha512', salt);
      hmac.update('correctPassword'); // Use a different password to generate the testHash
      const testHash = hmac.digest('hex');

      const result = service.validateHash(challenge, testHash, salt);

      expect(result).toBe(false);
    });
  });
});