import pkg from 'pg';
const { Pool } = pkg;
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Vector Store Service
 * Manages vector storage and similarity search using PostgreSQL + pgvector
 */

class VectorStoreService {
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      ...config.database.pool,
    });

    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', err);
    });

    logger.info('Vector store service initialized');
  }

  /**
   * Insert document chunk with embedding
   */
  async insertChunk(documentId, chunkIndex, content, embedding, metadata = {}) {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const embeddingArray = `[${embedding.join(',')}]`;

      const result = await client.query(query, [
        documentId,
        chunkIndex,
        content,
        embeddingArray,
        JSON.stringify(metadata),
      ]);

      logger.debug('Chunk inserted', {
        documentId,
        chunkId: result.rows[0].id,
        chunkIndex,
      });

      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to insert chunk:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert multiple chunks (batch)
   */
  async insertChunks(chunks) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const insertedIds = [];

      for (const chunk of chunks) {
        const query = `
          INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;

        const embeddingArray = `[${chunk.embedding.join(',')}]`;

        const result = await client.query(query, [
          chunk.documentId,
          chunk.chunkIndex,
          chunk.content,
          embeddingArray,
          JSON.stringify(chunk.metadata || {}),
        ]);

        insertedIds.push(result.rows[0].id);
      }

      await client.query('COMMIT');

      logger.info('Batch chunks inserted', {
        count: insertedIds.length,
      });

      return insertedIds;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to insert batch chunks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search similar chunks using cosine similarity
   */
  async searchSimilar(queryEmbedding, options = {}) {
    const {
      topK = config.rag.topK,
      threshold = config.rag.similarityThreshold,
      accessLevel = 'public',
      category = null,
      department = null,
    } = options;

    const client = await this.pool.connect();

    try {
      let query = `
        SELECT
          dc.id,
          dc.document_id,
          dc.chunk_index,
          dc.content,
          dc.metadata,
          d.title,
          d.source,
          d.category,
          d.department,
          d.access_level,
          1 - (dc.embedding <=> $1::vector) AS similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE 1 - (dc.embedding <=> $1::vector) >= $2
      `;

      const params = [`[${queryEmbedding.join(',')}]`, threshold];
      let paramIndex = 3;

      // Add access level filter
      if (accessLevel) {
        query += ` AND d.access_level = $${paramIndex}`;
        params.push(accessLevel);
        paramIndex++;
      }

      // Add category filter
      if (category) {
        query += ` AND d.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Add department filter
      if (department) {
        query += ` AND d.department = $${paramIndex}`;
        params.push(department);
        paramIndex++;
      }

      query += `
        ORDER BY similarity DESC
        LIMIT $${paramIndex}
      `;
      params.push(topK);

      const result = await client.query(query, params);

      logger.logRAG(
        'similarity_search',
        result.rows,
        {
          topK,
          threshold,
          resultsFound: result.rows.length,
        }
      );

      return result.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        title: row.title,
        source: row.source,
        category: row.category,
        department: row.department,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Similarity search failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get document chunks by document ID
   */
  async getDocumentChunks(documentId) {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, chunk_index, content, metadata, created_at
        FROM document_chunks
        WHERE document_id = $1
        ORDER BY chunk_index ASC
      `;

      const result = await client.query(query, [documentId]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get document chunks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete document chunks
   */
  async deleteDocumentChunks(documentId) {
    const client = await this.pool.connect();

    try {
      const query = 'DELETE FROM document_chunks WHERE document_id = $1';
      const result = await client.query(query, [documentId]);

      logger.info('Document chunks deleted', {
        documentId,
        deletedCount: result.rowCount,
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to delete document chunks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get total chunk count
   */
  async getTotalChunkCount() {
    const client = await this.pool.connect();

    try {
      const query = 'SELECT COUNT(*) as count FROM document_chunks';
      const result = await client.query(query);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get chunk count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create pgvector index if not exists
   */
  async createIndex() {
    const client = await this.pool.connect();

    try {
      // Check if index exists
      const checkQuery = `
        SELECT indexname
        FROM pg_indexes
        WHERE indexname = 'idx_document_chunks_embedding'
      `;

      const checkResult = await client.query(checkQuery);

      if (checkResult.rows.length === 0) {
        logger.info('Creating pgvector index...');

        const createQuery = `
          CREATE INDEX idx_document_chunks_embedding
          ON document_chunks
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `;

        await client.query(createQuery);

        logger.info('pgvector index created successfully');
      } else {
        logger.debug('pgvector index already exists');
      }
    } catch (error) {
      logger.error('Failed to create index:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const client = await this.pool.connect();

    try {
      const result = await client.query('SELECT 1 as ok');
      return result.rows[0].ok === 1;
    } catch (error) {
      logger.error('Vector store health check failed:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Close pool
   */
  async close() {
    await this.pool.end();
    logger.info('Vector store pool closed');
  }
}

// Singleton instance
const vectorStoreService = new VectorStoreService();

export default vectorStoreService;
