import axios from 'axios';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * n8n Service
 * Integration with n8n workflows for automation
 */

class N8nService {
  constructor() {
    if (!config.n8n.instanceUrl || !config.n8n.apiKey) {
      logger.warn('n8n credentials not configured');
      this.client = null;
      return;
    }

    this.client = axios.create({
      baseURL: config.n8n.instanceUrl,
      headers: {
        'X-N8N-API-KEY': config.n8n.apiKey,
        'Content-Type': 'application/json',
      },
    });

    logger.info('n8n service initialized', {
      instanceUrl: config.n8n.instanceUrl,
    });
  }

  /**
   * Trigger a webhook workflow
   */
  async triggerWebhook(webhookPath, data) {
    if (!this.client) {
      throw new Error('n8n service not initialized');
    }

    try {
      const response = await axios.post(
        `${config.n8n.instanceUrl}/webhook/${webhookPath}`,
        data
      );

      logger.info('n8n webhook triggered', {
        webhookPath,
        status: response.status,
      });

      return response.data;
    } catch (error) {
      logger.error('n8n webhook trigger failed:', error);
      throw error;
    }
  }

  /**
   * List all workflows
   */
  async listWorkflows() {
    if (!this.client) {
      throw new Error('n8n service not initialized');
    }

    try {
      const response = await this.client.get('/api/v1/workflows');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to list n8n workflows:', error);
      throw error;
    }
  }

  /**
   * Get workflow details
   */
  async getWorkflow(workflowId) {
    if (!this.client) {
      throw new Error('n8n service not initialized');
    }

    try {
      const response = await this.client.get(`/api/v1/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Log call to n8n (for CRM/analytics)
   */
  async logCall(callData) {
    try {
      return await this.triggerWebhook('log-call', {
        event: 'call_completed',
        data: callData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log call to n8n:', error);
      // Don't throw - logging failure shouldn't break the main flow
      return null;
    }
  }

  /**
   * Send email notification via n8n
   */
  async sendEmailNotification(emailData) {
    try {
      return await this.triggerWebhook('send-email', {
        event: 'email_notification',
        data: emailData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to send email via n8n:', error);
      return null;
    }
  }

  /**
   * Sync with CRM via n8n
   */
  async syncToCRM(crmData) {
    try {
      return await this.triggerWebhook('crm-sync', {
        event: 'crm_update',
        data: crmData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to sync to CRM via n8n:', error);
      return null;
    }
  }

  /**
   * Request callback via n8n
   */
  async requestCallback(callbackData) {
    try {
      return await this.triggerWebhook('request-callback', {
        event: 'callback_requested',
        data: callbackData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to request callback via n8n:', error);
      return null;
    }
  }

  /**
   * Send SMS notification via n8n
   */
  async sendSMSNotification(smsData) {
    try {
      return await this.triggerWebhook('send-sms', {
        event: 'sms_notification',
        data: smsData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to send SMS via n8n:', error);
      return null;
    }
  }
}

// Singleton instance
const n8nService = new N8nService();

export default n8nService;
