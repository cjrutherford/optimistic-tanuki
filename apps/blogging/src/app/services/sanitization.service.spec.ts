import { Test, TestingModule } from '@nestjs/testing';
import { SanitizationService } from './sanitization.service';

jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((content, config) => {
    // Basic mock behavior
    if (!content) return '';
    return content;
  }),
}));

import DOMPurify from 'isomorphic-dompurify';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeHtml', () => {
    it('should call DOMPurify.sanitize', () => {
      const input = '<p>Hello</p>';
      const result = service.sanitizeHtml(input);
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.any(Object));
      expect(result).toBe(input);
    });

    it('should return empty string for null/undefined', () => {
        expect(service.sanitizeHtml(null as any)).toBe('');
        expect(service.sanitizeHtml(undefined as any)).toBe('');
    });
  });

  describe('sanitizePlainText', () => {
    it('should call DOMPurify.sanitize with no tags allowed', () => {
      const input = 'Hello';
      service.sanitizePlainText(input);
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.objectContaining({
          ALLOWED_TAGS: []
      }));
    });

    it('should return empty string for non-string inputs', () => {
        expect(service.sanitizePlainText(null as any)).toBe('');
        expect(service.sanitizePlainText(123 as any)).toBe('');
    });
  });

  describe('sanitizeUserInput', () => {
    it('should call DOMPurify.sanitize with restrictive config', () => {
      const input = 'Hello';
      service.sanitizeUserInput(input);
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'br', 'strong'])
      }));
    });

    it('should return empty string for non-string inputs', () => {
        expect(service.sanitizeUserInput(null as any)).toBe('');
        expect(service.sanitizeUserInput({} as any)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should sanitize and validate safe URLs', () => {
      const input = 'https://example.com';
      const result = service.sanitizeUrl(input);
      expect(result).toBe(input);
    });

    it('should return null for non-string inputs', () => {
        expect(service.sanitizeUrl(null as any)).toBeNull();
        expect(service.sanitizeUrl([] as any)).toBeNull();
    });

    it('should reject unsafe protocols', () => {
        const input = 'javascript:alert(1)';
        const result = service.sanitizeUrl(input);
        expect(result).toBeNull();
    });

    it('should handle invalid URLs', () => {
        const result = service.sanitizeUrl('not-a-url');
        expect(result).toBeNull();
    });
  });

  describe('containsMaliciousPatterns', () => {
    it('should detect scripts', () => {
        expect(service.containsMaliciousPatterns('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect event handlers', () => {
        expect(service.containsMaliciousPatterns('<div onclick="alert(1)">')).toBe(true);
    });

    it('should return false for clean content', () => {
        expect(service.containsMaliciousPatterns('<p>Hello world</p>')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
        expect(service.containsMaliciousPatterns(null as any)).toBe(false);
        expect(service.containsMaliciousPatterns(true as any)).toBe(false);
    });

    it('should detect various malicious patterns', () => {
        expect(service.containsMaliciousPatterns('javascript:alert(1)')).toBe(true);
        expect(service.containsMaliciousPatterns('<iframe src="xxx">')).toBe(true);
        expect(service.containsMaliciousPatterns('<embed src="xxx">')).toBe(true);
        expect(service.containsMaliciousPatterns('<object data="xxx">')).toBe(true);
        expect(service.containsMaliciousPatterns('vbscript:msgbox(1)')).toBe(true);
        expect(service.containsMaliciousPatterns('data:text/html,<html>')).toBe(true);
    });
  });
});
