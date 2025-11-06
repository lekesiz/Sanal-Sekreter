import { google } from 'googleapis';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { maskPII } from '../../utils/security.js';

/**
 * Gmail Service
 * Read and search emails (read-only for privacy)
 */

class GmailService {
  constructor() {
    if (!config.googleWorkspace.clientId || !config.googleWorkspace.clientSecret) {
      logger.warn('Google Workspace credentials not configured');
      this.gmail = null;
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      config.googleWorkspace.clientId,
      config.googleWorkspace.clientSecret,
      config.googleWorkspace.redirectUri
    );

    if (config.googleWorkspace.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.googleWorkspace.refreshToken,
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    logger.info('Gmail service initialized');
  }

  /**
   * List messages
   */
  async listMessages(options = {}) {
    if (!this.gmail) {
      throw new Error('Gmail service not initialized');
    }

    try {
      const {
        query = '',
        maxResults = 10,
        pageToken = null,
        labelIds = ['INBOX'],
      } = options;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken,
        labelIds,
      });

      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      logger.error('Failed to list Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Get message details
   */
  async getMessage(messageId, format = 'full') {
    if (!this.gmail) {
      throw new Error('Gmail service not initialized');
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format,
      });

      const message = response.data;

      // Extract headers
      const headers = {};
      message.payload?.headers?.forEach(header => {
        headers[header.name.toLowerCase()] = header.value;
      });

      return {
        id: message.id,
        threadId: message.threadId,
        snippet: message.snippet,
        from: headers['from'],
        to: headers['to'],
        subject: headers['subject'],
        date: headers['date'],
        body: this.extractBody(message.payload),
        labels: message.labelIds,
      };
    } catch (error) {
      logger.error(`Failed to get message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Extract body from message payload
   */
  extractBody(payload) {
    let body = '';

    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return body;
  }

  /**
   * Search emails
   */
  async searchEmails(query, maxResults = 10) {
    return this.listMessages({ query, maxResults });
  }

  /**
   * Get unread count
   */
  async getUnreadCount() {
    if (!this.gmail) {
      throw new Error('Gmail service not initialized');
    }

    try {
      const response = await this.gmail.users.labels.get({
        userId: 'me',
        id: 'INBOX',
      });

      return response.data.messagesUnread || 0;
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      throw error;
    }
  }

  /**
   * Get recent emails summary (for virtual secretary context)
   */
  async getRecentSummary(maxResults = 5) {
    try {
      const { messages } = await this.listMessages({ maxResults });

      const summaries = [];

      for (const msg of messages) {
        const details = await this.getMessage(msg.id, 'metadata');
        summaries.push({
          id: details.id,
          from: maskPII(details.from),
          subject: details.subject,
          snippet: details.snippet,
          date: details.date,
        });
      }

      return summaries;
    } catch (error) {
      logger.error('Failed to get recent summary:', error);
      throw error;
    }
  }
}

// Singleton instance
const gmailService = new GmailService();

export default gmailService;
