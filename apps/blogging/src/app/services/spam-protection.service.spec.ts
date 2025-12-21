import { Test, TestingModule } from '@nestjs/testing';
import { SpamProtectionService } from './spam-protection.service';

describe('SpamProtectionService', () => {
  let service: SpamProtectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpamProtectionService],
    }).compile();

    service = module.get<SpamProtectionService>(SpamProtectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkForSpam', () => {
    it('should detect honeypot spam', () => {
      const result = service.checkForSpam({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello',
        honeypot: 'bot-filled-this',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('Honeypot');
    });

    it('should detect spam keywords', () => {
      const result = service.checkForSpam({
        name: 'Spammer',
        email: 'spam@example.com',
        message: 'Buy viagra now!',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('spam keyword');
    });

    it('should detect too many URLs', () => {
      const result = service.checkForSpam({
        name: 'Spammer',
        email: 'spam@example.com',
        message:
          'Check out http://link1.com http://link2.com http://link3.com http://link4.com',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('Too many URLs');
    });

    it('should detect excessive all caps', () => {
      const result = service.checkForSpam({
        name: 'Spammer',
        email: 'spam@example.com',
        message:
          'THIS MESSAGE CONTAINS VERYLONGALLCAPS WORDS EVERYWHERE INTHISMESSAGE',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('all caps');
    });

    it('should detect excessive repeated characters', () => {
      const result = service.checkForSpam({
        name: 'Spammer',
        email: 'spam@example.com',
        message: 'Hellooooooo!!!!!!! Greaaaaaaat!!!!!! Amaziiiiiiing!!!!!!',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('repeated characters');
    });

    it('should detect message too short', () => {
      const result = service.checkForSpam({
        name: 'John',
        email: 'john@example.com',
        message: 'Hi',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('should detect message too long', () => {
      const result = service.checkForSpam({
        name: 'John',
        email: 'john@example.com',
        message: 'a'.repeat(5001),
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('too long');
    });

    it('should detect invalid email format', () => {
      const result = service.checkForSpam({
        name: 'John',
        email: 'invalid-email',
        message: 'This is a valid message',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('Invalid email');
    });

    it('should detect suspicious email providers', () => {
      const result = service.checkForSpam({
        name: 'John',
        email: 'test@tempmail.com',
        message: 'This is a valid message',
      });

      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('Suspicious email provider');
    });

    it('should pass valid contact submission', () => {
      const result = service.checkForSpam({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a legitimate message with proper content.',
        honeypot: '',
      });

      expect(result.isSpam).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('validateContactData', () => {
    it('should validate proper contact data', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a valid message',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require name', () => {
      const result = service.validateContactData({
        name: '',
        email: 'john@example.com',
        message: 'This is a valid message',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should require email', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: '',
        message: 'This is a valid message',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should require message', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'john@example.com',
        message: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is required');
    });

    it('should validate email format', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'invalid-email',
        message: 'This is a valid message',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should enforce name length limit', () => {
      const result = service.validateContactData({
        name: 'a'.repeat(101),
        email: 'john@example.com',
        message: 'This is a valid message',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is too long (max 100 characters)');
    });

    it('should enforce message minimum length', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Short',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message is too short (min 10 characters)'
      );
    });

    it('should enforce message maximum length', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'a'.repeat(5001),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message is too long (max 5000 characters)'
      );
    });

    it('should enforce phone number length limit', () => {
      const result = service.validateContactData({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a valid message',
        phone: '1'.repeat(21),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number is too long');
    });
  });
});
