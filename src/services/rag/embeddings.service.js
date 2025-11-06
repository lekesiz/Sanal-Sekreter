import OpenAI from 'openai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Embeddings Service
 * Generate vector embeddings for text chunks using OpenAI
 */

class EmbeddingsService {
  constructor() {
    if (!config.openai.apiKey) {
      logger.warn('OpenAI API key not configured, embeddings service disabled');
      this.client = null;
      return;
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      organization: config.openai.orgId,
    });

    this.model = config.rag.embeddingModel;
    this.dimension = config.rag.vectorDimension;

    logger.info('Embeddings service initialized', {
      model: this.model,
      dimension: this.dimension,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    if (!this.client) {
      throw new Error('Embeddings service not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      logger.debug('Embedding generated', {
        textLength: text.length,
        embeddingDimension: embedding.length,
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts) {
    if (!this.client) {
      throw new Error('Embeddings service not initialized');
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    // Filter out empty texts
    const validTexts = texts.filter(text => text && text.trim().length > 0);

    if (validTexts.length === 0) {
      throw new Error('No valid texts to embed');
    }

    try {
      // OpenAI allows up to 2048 texts per batch
      const batchSize = 2048;
      const batches = [];

      for (let i = 0; i < validTexts.length; i += batchSize) {
        batches.push(validTexts.slice(i, i + batchSize));
      }

      const allEmbeddings = [];

      for (const batch of batches) {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          encoding_format: 'float',
        });

        const embeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...embeddings);

        logger.debug('Batch embeddings generated', {
          batchSize: batch.length,
          totalSoFar: allEmbeddings.length,
        });
      }

      logger.info('All embeddings generated', {
        totalTexts: validTexts.length,
        totalEmbeddings: allEmbeddings.length,
      });

      return allEmbeddings;
    } catch (error) {
      logger.error('Failed to generate batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar embeddings from a list
   */
  findMostSimilar(queryEmbedding, candidateEmbeddings, topK = 5) {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    return similarities.slice(0, topK);
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  chunkText(text, chunkSize = 500, overlap = 50) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const words = text.split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk,
          startIndex: i,
          endIndex: Math.min(i + chunkSize, words.length),
        });
      }
    }

    return chunks;
  }

  /**
   * Chunk text by sentences (more semantic)
   */
  chunkBySentences(text, maxChunkSize = 500) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split by sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();

      if ((currentChunk + ' ' + trimmed).length <= maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmed;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.map((chunk, index) => ({
      text: chunk,
      chunkIndex: index,
    }));
  }

  /**
   * Prepare text for embedding (clean and normalize)
   */
  prepareText(text) {
    if (!text) return '';

    // Remove extra whitespace
    let prepared = text.replace(/\s+/g, ' ').trim();

    // Remove special characters that might interfere
    prepared = prepared.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Normalize unicode
    prepared = prepared.normalize('NFC');

    return prepared;
  }

  /**
   * Estimate tokens (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters in English
    // For French/Turkish, might be slightly different
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text is within token limit
   */
  isWithinTokenLimit(text, maxTokens = 8191) {
    const estimatedTokens = this.estimateTokens(text);
    return estimatedTokens <= maxTokens;
  }
}

// Singleton instance
const embeddingsService = new EmbeddingsService();

export default embeddingsService;
