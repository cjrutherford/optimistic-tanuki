import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class SanitizationService {
  private purify: typeof DOMPurify;

  constructor() {
    // Initialize DOMPurify with JSDOM for server-side usage
    this.purify = DOMPurify;
    console.log('SanitizationService initialized');
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   * Allows safe HTML tags and attributes for blog content
   */
  sanitizeHtml(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const config = {
      ALLOWED_TAGS: [
        // Text formatting
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'sub',
        'sup',
        'mark',
        // Headings
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        // Lists
        'ul',
        'ol',
        'li',
        // Links and media
        'a',
        'img',
        'figure',
        'figcaption',
        // Code
        'pre',
        'code',
        'blockquote',
        // Tables
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        // Divs and spans (for styling)
        'div',
        'span',
        // Horizontal rule
        'hr',
      ],
      ALLOWED_ATTR: [
        'componentid',
        'instanceid',
        'data',
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'style',
        'target',
        'rel',
        'width',
        'height',
        'data-*', // Allow data attributes for components
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      SANITIZE_DOM: true,
      FORCE_BODY: false,
      SAFE_FOR_TEMPLATES: true,
    };

    const sanitizedContent = this.purify.sanitize(content, config);
    console.log('Content sanitized successfully');
    console.log(`Sanitized Content: ${sanitizedContent}`);
    const dom = new JSDOM(sanitizedContent);
    const componentNodes = dom.window.document.querySelectorAll('div.angular-component-node');

    componentNodes.forEach((node) => {
      const componentId = node.getAttribute('componentid');
      const instanceId = node.getAttribute('instanceid');
      const data = node.getAttribute('data');
      console.log(
        `Found component node - componentId: ${componentId}, instanceId: ${instanceId} data: ${JSON.stringify(data)}`
      );
    });

    return sanitizedContent;
  }

  /**
   * Sanitize plain text (strip all HTML tags)
   */
  sanitizePlainText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Strip all HTML tags
    return this.purify.sanitize(text, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * Sanitize user input for safe storage
   * This is more restrictive than sanitizeHtml
   */
  sanitizeUserInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    const config = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      KEEP_CONTENT: true,
    };

    return this.purify.sanitize(input, config);
  }

  /**
   * Validate and sanitize URL
   */
  sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Remove any HTML tags from URL
    const cleaned = this.purify.sanitize(url, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: false,
    });

    // Validate URL format
    try {
      const urlObj = new URL(cleaned);
      // Only allow http, https, and mailto protocols
      if (['http:', 'https:', 'mailto:'].includes(urlObj.protocol)) {
        return cleaned;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if content contains potentially malicious patterns
   */
  containsMaliciousPatterns(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const maliciousPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /\bon\w+\s*=/gi, // Event handlers like onclick= (word boundary ensures "on" is not part of another word like "component")
      /<iframe[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<object[^>]*>/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
    ];

    for (const pattern of maliciousPatterns) {
      const match = content.match(pattern);
      if (match) {
        console.warn(`Malicious pattern detected: ${pattern}`);
        console.warn(`Matching content: ${match}`);
        return true;
      }
    }

    return false;
  }
}
