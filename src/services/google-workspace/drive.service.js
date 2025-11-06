import { google } from 'googleapis';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import ragService from '../rag/rag.service.js';

/**
 * Google Drive Service
 * Fetch and index documents from Google Drive for RAG system
 */

class DriveService {
  constructor() {
    if (!config.googleWorkspace.clientId || !config.googleWorkspace.clientSecret) {
      logger.warn('Google Workspace credentials not configured');
      this.drive = null;
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

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    logger.info('Google Drive service initialized');
  }

  /**
   * List files in Drive
   */
  async listFiles(options = {}) {
    if (!this.drive) {
      throw new Error('Drive service not initialized');
    }

    try {
      const {
        folderId = null,
        mimeType = null,
        pageSize = 100,
        pageToken = null,
      } = options;

      let query = 'trashed = false';

      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      if (mimeType) {
        query += ` and mimeType='${mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc',
      });

      logger.debug('Drive files listed', {
        count: response.data.files.length,
      });

      return {
        files: response.data.files,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      logger.error('Failed to list Drive files:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    if (!this.drive) {
      throw new Error('Drive service not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: '*',
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get file metadata for ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Download file content
   */
  async downloadFile(fileId, mimeType = null) {
    if (!this.drive) {
      throw new Error('Drive service not initialized');
    }

    try {
      let response;

      // Google Docs, Sheets, Slides need export
      const exportMimeTypes = {
        'application/vnd.google-apps.document': 'text/plain',
        'application/vnd.google-apps.spreadsheet': 'text/csv',
        'application/vnd.google-apps.presentation': 'text/plain',
      };

      if (mimeType && exportMimeTypes[mimeType]) {
        response = await this.drive.files.export({
          fileId,
          mimeType: exportMimeTypes[mimeType],
        }, {
          responseType: 'text',
        });
      } else {
        response = await this.drive.files.get({
          fileId,
          alt: 'media',
        }, {
          responseType: 'text',
        });
      }

      return response.data;
    } catch (error) {
      logger.error(`Failed to download file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Index all documents from a folder for RAG
   */
  async indexFolder(folderId, options = {}) {
    try {
      logger.info('Starting folder indexing', { folderId });

      const {
        category = 'General',
        department = null,
        accessLevel = 'public',
        recursive = false,
      } = options;

      let allFiles = [];
      let pageToken = null;

      // Fetch all files
      do {
        const result = await this.listFiles({
          folderId,
          pageToken,
        });

        allFiles = allFiles.concat(result.files);
        pageToken = result.nextPageToken;
      } while (pageToken);

      logger.info('Files to index', { count: allFiles.length });

      const indexedCount = 0;
      const errors = [];

      for (const file of allFiles) {
        try {
          await this.indexFile(file.id, {
            category,
            department,
            accessLevel,
          });
        } catch (error) {
          logger.error(`Failed to index file ${file.id}:`, error);
          errors.push({
            fileId: file.id,
            fileName: file.name,
            error: error.message,
          });
        }
      }

      logger.info('Folder indexing completed', {
        folderId,
        total: allFiles.length,
        indexed: allFiles.length - errors.length,
        errors: errors.length,
      });

      return {
        total: allFiles.length,
        indexed: allFiles.length - errors.length,
        errors,
      };
    } catch (error) {
      logger.error('Folder indexing failed:', error);
      throw error;
    }
  }

  /**
   * Index a single file for RAG
   */
  async indexFile(fileId, options = {}) {
    try {
      // Get file metadata
      const metadata = await this.getFileMetadata(fileId);

      logger.info('Indexing file', {
        fileId,
        name: metadata.name,
        mimeType: metadata.mimeType,
      });

      // Download content
      const content = await this.downloadFile(fileId, metadata.mimeType);

      if (!content || content.trim().length === 0) {
        logger.warn('File has no content, skipping', { fileId });
        return null;
      }

      // Prepare document for RAG
      const document = {
        id: fileId,
        title: metadata.name,
        content,
        source: 'drive',
        sourceId: fileId,
        category: options.category || 'General',
        department: options.department || null,
        accessLevel: options.accessLevel || 'public',
        metadata: {
          mimeType: metadata.mimeType,
          createdTime: metadata.createdTime,
          modifiedTime: metadata.modifiedTime,
          webViewLink: metadata.webViewLink,
          size: metadata.size,
        },
      };

      // Index with RAG service
      const result = await ragService.indexDocument(document);

      logger.info('File indexed successfully', {
        fileId,
        chunksIndexed: result.chunksIndexed,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to index file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Search files
   */
  async searchFiles(query) {
    if (!this.drive) {
      throw new Error('Drive service not initialized');
    }

    try {
      const response = await this.drive.files.list({
        q: `fullText contains '${query}' and trashed = false`,
        pageSize: 10,
        fields: 'files(id, name, mimeType, webViewLink)',
      });

      return response.data.files;
    } catch (error) {
      logger.error('Failed to search Drive files:', error);
      throw error;
    }
  }

  /**
   * Watch for changes (webhook)
   */
  async watchChanges(channelId, webhookUrl) {
    if (!this.drive) {
      throw new Error('Drive service not initialized');
    }

    try {
      const response = await this.drive.changes.watch({
        pageToken: '1',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
        },
      });

      logger.info('Drive watch set up', {
        channelId,
        expiration: response.data.expiration,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to set up Drive watch:', error);
      throw error;
    }
  }
}

// Singleton instance
const driveService = new DriveService();

export default driveService;
