import { Injectable } from '@nestjs/common';

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
}

@Injectable()
export class SpamProtectionService {
  private readonly spamKeywords = [
    'viagra',
    'cialis',
    'casino',
    'poker',
    'forex',
    'crypto investment',
    'make money fast',
    'click here now',
    'limited time offer',
  ];

  private readonly suspiciousPatterns = [
    /\bhttps?:\/\/[^\s]+/gi, // Multiple URLs
    /\b[A-Z]{10,}\b/g, // All caps words
    /(.)\1{4,}/g, // Repeated characters
  ];

  /**
   * Check if contact submission appears to be spam
   */
  checkForSpam(data: {
    name?: string;
    email?: string;
    message?: string;
    honeypot?: string; // Hidden field that should remain empty
  }): SpamCheckResult {
    // Honeypot check - if filled, it's a bot
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return {
        isSpam: true,
        reason: 'Honeypot field was filled',
      };
    }

    // Check for spam keywords
    const content = `${data.name || ''} ${data.email || ''} ${data.message || ''}`.toLowerCase();
    for (const keyword of this.spamKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        return {
          isSpam: true,
          reason: `Contains spam keyword: ${keyword}`,
        };
      }
    }

    // Check for suspicious patterns
    const urlMatches = data.message?.match(this.suspiciousPatterns[0]);
    if (urlMatches && urlMatches.length > 3) {
      return {
        isSpam: true,
        reason: 'Too many URLs in message',
      };
    }

    // Check for all caps abuse
    if (data.message) {
      const capsMatches = data.message.match(this.suspiciousPatterns[1]);
      if (capsMatches && capsMatches.length > 2) {
        return {
          isSpam: true,
          reason: 'Excessive use of all caps',
        };
      }
    }

    // Check for repeated characters
    if (data.message) {
      const repeatedMatches = data.message.match(this.suspiciousPatterns[2]);
      if (repeatedMatches && repeatedMatches.length > 3) {
        return {
          isSpam: true,
          reason: 'Excessive repeated characters',
        };
      }
    }

    // Check message length - too short or too long
    if (data.message) {
      if (data.message.length < 10) {
        return {
          isSpam: true,
          reason: 'Message too short',
        };
      }
      if (data.message.length > 5000) {
        return {
          isSpam: true,
          reason: 'Message too long',
        };
      }
    }

    // Email validation
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return {
          isSpam: true,
          reason: 'Invalid email format',
        };
      }

      // Check for suspicious email patterns
      const suspiciousEmailPatterns = [
        /@(tempmail|throwaway|guerrillamail|mailinator)\./i,
        /^[a-z]{20,}@/i, // Very long random email prefix
      ];

      for (const pattern of suspiciousEmailPatterns) {
        if (pattern.test(data.email)) {
          return {
            isSpam: true,
            reason: 'Suspicious email provider',
          };
        }
      }
    }

    return {
      isSpam: false,
    };
  }

  /**
   * Validate contact form data
   */
  validateContactData(data: {
    name?: string;
    email?: string;
    message?: string;
    phone?: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    } else if (data.name.length > 100) {
      errors.push('Name is too long (max 100 characters)');
    }

    if (!data.email || data.email.trim().length === 0) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    if (!data.message || data.message.trim().length === 0) {
      errors.push('Message is required');
    } else if (data.message.length < 10) {
      errors.push('Message is too short (min 10 characters)');
    } else if (data.message.length > 5000) {
      errors.push('Message is too long (max 5000 characters)');
    }

    if (data.phone && data.phone.length > 20) {
      errors.push('Phone number is too long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
