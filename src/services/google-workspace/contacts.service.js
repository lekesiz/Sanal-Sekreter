import { google } from 'googleapis';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Google Contacts Service (People API)
 * Search and retrieve contact information
 */

class ContactsService {
  constructor() {
    if (!config.googleWorkspace.clientId || !config.googleWorkspace.clientSecret) {
      logger.warn('Google Workspace credentials not configured');
      this.people = null;
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

    this.people = google.people({ version: 'v1', auth: this.oauth2Client });
    logger.info('Google Contacts service initialized');
  }

  /**
   * Search contacts by query
   */
  async searchContacts(query, pageSize = 10) {
    if (!this.people) {
      throw new Error('Contacts service not initialized');
    }

    try {
      const response = await this.people.people.searchContacts({
        query,
        pageSize,
        readMask: 'names,emailAddresses,phoneNumbers,organizations',
      });

      const results = response.data.results || [];

      return results.map(result => this.formatContact(result.person));
    } catch (error) {
      logger.error('Failed to search contacts:', error);
      throw error;
    }
  }

  /**
   * Get contact by phone number
   */
  async getContactByPhone(phoneNumber) {
    try {
      // Normalize phone number for search
      const normalized = phoneNumber.replace(/[^\d+]/g, '');

      const contacts = await this.searchContacts(normalized, 5);

      // Filter to match phone number exactly
      const match = contacts.find(contact =>
        contact.phoneNumbers?.some(phone =>
          phone.value.replace(/[^\d+]/g, '') === normalized
        )
      );

      return match || null;
    } catch (error) {
      logger.error('Failed to get contact by phone:', error);
      throw error;
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email) {
    try {
      const contacts = await this.searchContacts(email, 5);

      const match = contacts.find(contact =>
        contact.emails?.some(e => e.value.toLowerCase() === email.toLowerCase())
      );

      return match || null;
    } catch (error) {
      logger.error('Failed to get contact by email:', error);
      throw error;
    }
  }

  /**
   * List all contacts
   */
  async listContacts(pageSize = 100, pageToken = null) {
    if (!this.people) {
      throw new Error('Contacts service not initialized');
    }

    try {
      const response = await this.people.people.connections.list({
        resourceName: 'people/me',
        pageSize,
        pageToken,
        personFields: 'names,emailAddresses,phoneNumbers,organizations',
      });

      return {
        contacts: (response.data.connections || []).map(person => this.formatContact(person)),
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      logger.error('Failed to list contacts:', error);
      throw error;
    }
  }

  /**
   * Format contact object
   */
  formatContact(person) {
    if (!person) return null;

    const name = person.names?.[0];
    const emails = person.emailAddresses?.map(e => ({
      value: e.value,
      type: e.type,
    })) || [];

    const phoneNumbers = person.phoneNumbers?.map(p => ({
      value: p.value,
      type: p.type,
    })) || [];

    const organization = person.organizations?.[0];

    return {
      resourceName: person.resourceName,
      displayName: name?.displayName,
      givenName: name?.givenName,
      familyName: name?.familyName,
      emails,
      phoneNumbers,
      organization: organization ? {
        name: organization.name,
        title: organization.title,
      } : null,
    };
  }

  /**
   * Get contact details by resource name
   */
  async getContact(resourceName) {
    if (!this.people) {
      throw new Error('Contacts service not initialized');
    }

    try {
      const response = await this.people.people.get({
        resourceName,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
      });

      return this.formatContact(response.data);
    } catch (error) {
      logger.error(`Failed to get contact ${resourceName}:`, error);
      throw error;
    }
  }
}

// Singleton instance
const contactsService = new ContactsService();

export default contactsService;
