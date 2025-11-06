import config from '../config/index.js';

/**
 * General helper functions
 */

/**
 * Check if current time is within business hours
 */
export const isBusinessHours = (timezone = config.routing.timezone) => {
  const now = new Date().toLocaleString('en-US', { timeZone: timezone });
  const currentDate = new Date(now);
  const currentDay = currentDate.getDay();
  const currentTime = currentDate.toTimeString().slice(0, 5);

  const { start, end, days } = config.routing.businessHours;

  const isBusinessDay = days.includes(currentDay);
  const isWithinHours = currentTime >= start && currentTime <= end;

  return isBusinessDay && isWithinHours;
};

/**
 * Format duration in seconds to human-readable format
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

/**
 * Parse duration string to seconds
 */
export const parseDuration = (durationStr) => {
  const match = durationStr.match(/(\d+)([hms])/g);
  if (!match) return 0;

  let totalSeconds = 0;

  match.forEach((part) => {
    const value = parseInt(part.slice(0, -1));
    const unit = part.slice(-1);

    switch (unit) {
      case 'h':
        totalSeconds += value * 3600;
        break;
      case 'm':
        totalSeconds += value * 60;
        break;
      case 's':
        totalSeconds += value;
        break;
    }
  });

  return totalSeconds;
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Chunk array into smaller arrays
 */
export const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge objects deeply
 */
export const deepMerge = (target, ...sources) => {
  if (!sources.length) return target;

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
};

/**
 * Check if value is an object
 */
export const isObject = (item) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Generate unique ID
 */
export const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
};

/**
 * Parse language code from locale
 */
export const parseLanguageCode = (locale) => {
  // tr-TR -> tr, fr-FR -> fr
  return locale.split('-')[0];
};

/**
 * Detect language from text (simple heuristic)
 */
export const detectLanguage = (text) => {
  // Turkish characters
  const turkishChars = /[ğüşıöçĞÜŞİÖÇ]/;

  // French characters
  const frenchChars = /[àâæçéèêëïîôùûüÿœÀÂÆÇÉÈÊËÏÎÔÙÛÜŸŒ]/;

  if (turkishChars.test(text)) {
    return 'tr-TR';
  }

  if (frenchChars.test(text)) {
    return 'fr-FR';
  }

  // Default to Turkish
  return 'tr-TR';
};

/**
 * Extract intent confidence score
 */
export const calculateConfidence = (scores) => {
  if (!scores || scores.length === 0) return 0;

  const max = Math.max(...scores);
  const sum = scores.reduce((a, b) => a + b, 0);

  // Normalized confidence (0-1)
  return max / sum;
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Format based on length
  if (cleaned.startsWith('+33')) {
    // French format: +33 1 23 45 67 89
    return cleaned.replace(/(\+33)(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5 $6');
  }

  if (cleaned.startsWith('+90')) {
    // Turkish format: +90 212 123 45 67
    return cleaned.replace(/(\+90)(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }

  return phoneNumber;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 100, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Convert object to query string
 */
export const toQueryString = (params) => {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

/**
 * Parse query string to object
 */
export const parseQueryString = (queryString) => {
  const params = new URLSearchParams(queryString);
  const result = {};

  for (const [key, value] of params) {
    result[key] = value;
  }

  return result;
};

/**
 * Calculate percentage
 */
export const percentage = (part, total, decimals = 2) => {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(decimals));
};

/**
 * Check if string is valid JSON
 */
export const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Safe JSON parse with fallback
 */
export const safeJSONParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
};

export default {
  isBusinessHours,
  formatDuration,
  parseDuration,
  sleep,
  retry,
  chunk,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  isObject,
  generateId,
  parseLanguageCode,
  detectLanguage,
  calculateConfidence,
  formatPhoneNumber,
  truncate,
  toQueryString,
  parseQueryString,
  percentage,
  isValidJSON,
  safeJSONParse,
};
