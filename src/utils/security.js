import crypto from 'crypto';
import config from '../config/index.js';
import logger from './logger.js';

/**
 * Security utilities for PII masking, encryption, and sanitization
 */

/**
 * Mask PII (Personally Identifiable Information) in text
 */
export const maskPII = (text) => {
  if (!config.security.piiMaskingEnabled || !text) {
    return text;
  }

  let maskedText = text;

  // Mask email addresses
  maskedText = maskedText.replace(
    /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    '***@***.***'
  );

  // Mask phone numbers (various formats)
  maskedText = maskedText.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    '***-***-****'
  );

  // Mask credit card numbers
  maskedText = maskedText.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    '****-****-****-****'
  );

  // Mask Turkish TC Kimlik No (11 digits)
  maskedText = maskedText.replace(/\b\d{11}\b/g, '***********');

  // Mask IBAN
  maskedText = maskedText.replace(
    /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/gi,
    'TR** **** **** **** **** ****'
  );

  return maskedText;
};

/**
 * Encrypt sensitive data
 */
export const encrypt = (text) => {
  if (!text || !config.security.encryptionKey) {
    return text;
  }

  try {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText || !config.security.encryptionKey) {
    return encryptedText;
  }

  try {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(config.security.encryptionKey, 'hex');
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    return null;
  }
};

/**
 * Hash data (one-way)
 */
export const hash = (data, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(data).digest('hex');
};

/**
 * Sanitize user input to prevent injection attacks
 */
export const sanitizeInput = (input) => {
  if (!input) return input;

  if (typeof input === 'string') {
    // Remove potential SQL injection characters
    let sanitized = input.replace(/[;'"\\]/g, '');

    // Remove potential XSS characters
    sanitized = sanitized.replace(/[<>]/g, '');

    return sanitized.trim();
  }

  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Check if it matches international format
  const internationalRegex = /^\+\d{10,15}$/;

  return internationalRegex.test(cleaned);
};

/**
 * Normalize phone number to E.164 format
 */
export const normalizePhoneNumber = (phoneNumber, defaultCountryCode = '+33') => {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');

  // If doesn't start with +, add default country code
  if (!normalized.startsWith('+')) {
    // Remove leading 0 if present
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = `${defaultCountryCode}${normalized}`;
  }

  return normalized;
};

/**
 * Generate secure random token
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Verify HMAC signature (for webhook validation)
 */
export const verifyHMAC = (payload, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Check if text contains sensitive information
 */
export const containsSensitiveInfo = (text) => {
  if (!text) return false;

  const patterns = [
    /\b\d{16}\b/, // Credit card
    /\b\d{11}\b/, // TC Kimlik
    /[A-Z]{2}\d{2}[A-Z0-9]{1,30}/i, // IBAN
    /password|şifre|parola/i, // Password mentions
  ];

  return patterns.some(pattern => pattern.test(text));
};

/**
 * Redact sensitive information from logs
 */
export const redactForLogging = (data) => {
  if (typeof data === 'string') {
    return maskPII(data);
  }

  if (typeof data === 'object' && data !== null) {
    const redacted = { ...data };

    // List of keys that should be redacted
    const sensitiveKeys = [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      'phoneNumber',
      'email',
      'address',
    ];

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        redacted[key] = '***REDACTED***';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = redactForLogging(redacted[key]);
      } else if (typeof redacted[key] === 'string') {
        redacted[key] = maskPII(redacted[key]);
      }
    }

    return redacted;
  }

  return data;
};

/**
 * Rate limiting key generator
 */
export const generateRateLimitKey = (identifier, action = 'default') => {
  return `ratelimit:${action}:${hash(identifier, 'md5')}`;
};

export default {
  maskPII,
  encrypt,
  decrypt,
  hash,
  sanitizeInput,
  validatePhoneNumber,
  normalizePhoneNumber,
  generateToken,
  verifyHMAC,
  containsSensitiveInfo,
  redactForLogging,
  generateRateLimitKey,
};
