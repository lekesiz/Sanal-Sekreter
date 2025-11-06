import embeddingsService from './embeddings.service.js';
import vectorStoreService from './vector-store.service.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

/**
 * RAG (Retrieval-Augmented Generation) Service
 * Main orchestrator for document retrieval and context generation
 */

class RAGService {
  constructor() {
    this.topK = config.rag.topK;
    this.similarityThreshold = config.rag.similarityThreshold;
    logger.info('RAG service initialized');
  }

  /**
   * Query the RAG system
   */
  async query(question, options = {}) {
    try {
      logger.debug('RAG query received', { question });

      // 1. Generate embedding for the question
      const queryEmbedding = await embeddingsService.generateEmbedding(question);

      // 2. Search for similar chunks
      const searchOptions = {
        topK: options.topK || this.topK,
        threshold: options.threshold || this.similarityThreshold,
        accessLevel: options.accessLevel || 'public',
        category: options.category,
        department: options.department,
      };

      const results = await vectorStoreService.searchSimilar(
        queryEmbedding,
        searchOptions
      );

      // 3. Format results with context
      const context = this.formatContext(results);

      logger.logRAG(question, results, {
        resultsCount: results.length,
        topScore: results[0]?.similarity,
      });

      return {
        question,
        results,
        context,
        hasResults: results.length > 0,
        topScore: results[0]?.similarity || 0,
      };
    } catch (error) {
      logger.error('RAG query failed:', error);
      throw error;
    }
  }

  /**
   * Format retrieved chunks into context for LLM
   */
  formatContext(results) {
    if (!results || results.length === 0) {
      return '';
    }

    const contextParts = results.map((result, index) => {
      return `[Source ${index + 1}: ${result.title} - ${result.category}]\n${result.content}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Get sources from results
   */
  getSources(results) {
    if (!results || results.length === 0) {
      return [];
    }

    // Deduplicate by document ID
    const uniqueSources = new Map();

    results.forEach(result => {
      if (!uniqueSources.has(result.documentId)) {
        uniqueSources.set(result.documentId, {
          documentId: result.documentId,
          title: result.title,
          source: result.source,
          category: result.category,
          department: result.department,
        });
      }
    });

    return Array.from(uniqueSources.values());
  }

  /**
   * Index a document
   */
  async indexDocument(document) {
    try {
      logger.info('Indexing document', {
        documentId: document.id,
        title: document.title,
      });

      // 1. Chunk the document content
      const chunks = embeddingsService.chunkBySentences(
        document.content,
        500 // max chunk size
      );

      logger.debug('Document chunked', {
        documentId: document.id,
        chunksCount: chunks.length,
      });

      // 2. Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await embeddingsService.generateEmbeddings(texts);

      // 3. Prepare chunks for insertion
      const chunksToInsert = chunks.map((chunk, index) => ({
        documentId: document.id,
        chunkIndex: index,
        content: chunk.text,
        embedding: embeddings[index],
        metadata: {
          ...document.metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      // 4. Insert into vector store
      const insertedIds = await vectorStoreService.insertChunks(chunksToInsert);

      logger.info('Document indexed successfully', {
        documentId: document.id,
        chunksIndexed: insertedIds.length,
      });

      return {
        documentId: document.id,
        chunksIndexed: insertedIds.length,
        chunkIds: insertedIds,
      };
    } catch (error) {
      logger.error('Failed to index document:', error);
      throw error;
    }
  }

  /**
   * Reindex a document (delete old chunks and create new ones)
   */
  async reindexDocument(document) {
    try {
      // Delete existing chunks
      await vectorStoreService.deleteDocumentChunks(document.id);

      // Index the document
      return await this.indexDocument(document);
    } catch (error) {
      logger.error('Failed to reindex document:', error);
      throw error;
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(documentId) {
    try {
      const deletedCount = await vectorStoreService.deleteDocumentChunks(documentId);

      logger.info('Document deleted from index', {
        documentId,
        chunksDeleted: deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete document from index:', error);
      throw error;
    }
  }

  /**
   * Build prompt with RAG context
   */
  buildPromptWithContext(query, ragResults, systemPrompt = '') {
    const context = this.formatContext(ragResults.results);
    const sources = this.getSources(ragResults.results);

    let prompt = systemPrompt ? `${systemPrompt}\n\n` : '';

    if (context) {
      prompt += `Context from knowledge base:\n\n${context}\n\n`;
      prompt += `Available sources:\n${sources.map((s, i) => `${i + 1}. ${s.title} (${s.category})`).join('\n')}\n\n`;
    }

    prompt += `User question: ${query}\n\n`;
    prompt += `Please provide an accurate answer based on the context above. If the context doesn't contain the information needed, acknowledge this.`;

    return prompt;
  }

  /**
   * Validate query (check for sensitive information)
   */
  async validateQuery(query, userContext = {}) {
    // Check if user has permission to access certain categories
    const restrictedCategories = ['confidential', 'internal'];

    if (
      restrictedCategories.some(cat => query.toLowerCase().includes(cat)) &&
      !userContext.hasHighAccess
    ) {
      logger.logSecurity('restricted_query_attempt', {
        query,
        userId: userContext.userId,
      });

      return {
        valid: false,
        reason: 'Query contains restricted content',
      };
    }

    return { valid: true };
  }

  /**
   * Get RAG statistics
   */
  async getStats() {
    try {
      const totalChunks = await vectorStoreService.getTotalChunkCount();

      return {
        totalChunks,
        topK: this.topK,
        similarityThreshold: this.similarityThreshold,
        embeddingModel: embeddingsService.model,
        vectorDimension: embeddingsService.dimension,
      };
    } catch (error) {
      logger.error('Failed to get RAG stats:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const vectorStoreHealthy = await vectorStoreService.healthCheck();
      const embeddingsHealthy = embeddingsService.client !== null;

      return {
        healthy: vectorStoreHealthy && embeddingsHealthy,
        vectorStore: vectorStoreHealthy,
        embeddings: embeddingsHealthy,
      };
    } catch (error) {
      logger.error('RAG health check failed:', error);
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const ragService = new RAGService();

export default ragService;
