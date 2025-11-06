import OpenAI from 'openai';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * OpenAI Service
 * Direct integration with OpenAI API for LLM capabilities
 */

class OpenAIService {
  constructor() {
    if (!config.openai.apiKey) {
      logger.warn('OpenAI API key not configured');
      this.client = null;
      return;
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      organization: config.openai.orgId,
    });

    this.model = config.openai.model || 'gpt-4o';
    logger.info('OpenAI service initialized', { model: this.model });
  }

  /**
   * Generate chat completion
   */
  async generateResponse(messages, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const startTime = Date.now();

      const {
        model = this.model,
        temperature = 0.7,
        maxTokens = 500,
        functions = null,
      } = options;

      const requestParams = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (functions) {
        requestParams.functions = functions;
        requestParams.function_call = 'auto';
      }

      const response = await this.client.chat.completions.create(requestParams);

      const latency = Date.now() - startTime;

      const result = {
        message: response.choices[0].message.content,
        functionCall: response.choices[0].message.function_call,
        finishReason: response.choices[0].finish_reason,
        usage: response.usage,
        latency,
      };

      logger.logLLM(model, messages, result.message, {
        tokensUsed: response.usage.total_tokens,
        latency,
      });

      return result;
    } catch (error) {
      logger.error('OpenAI completion failed:', error);
      throw error;
    }
  }

  /**
   * Generate streaming response
   */
  async *generateStreamingResponse(messages, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI service not initialized');
    }

    const {
      model = this.model,
      temperature = 0.7,
      maxTokens = 500,
    } = options;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('OpenAI streaming failed:', error);
      throw error;
    }
  }

  /**
   * Create embeddings (alias to embeddings service)
   */
  async createEmbedding(text, model = 'text-embedding-3-small') {
    if (!this.client) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('OpenAI embedding failed:', error);
      throw error;
    }
  }

  /**
   * Summarize text
   */
  async summarize(text, maxLength = 100) {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes text concisely.',
      },
      {
        role: 'user',
        content: `Please summarize the following text in ${maxLength} words or less:\n\n${text}`,
      },
    ];

    const response = await this.generateResponse(messages, {
      temperature: 0.3,
      maxTokens: maxLength * 2,
    });

    return response.message;
  }

  /**
   * Extract structured data from text
   */
  async extractStructuredData(text, schema) {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that extracts structured data from text. Return ONLY valid JSON.',
      },
      {
        role: 'user',
        content: `Extract the following information from the text and return as JSON:\n\nSchema: ${JSON.stringify(schema)}\n\nText: ${text}`,
      },
    ];

    const response = await this.generateResponse(messages, {
      temperature: 0.1,
      maxTokens: 500,
    });

    try {
      return JSON.parse(response.message);
    } catch (error) {
      logger.error('Failed to parse extracted data:', error);
      return null;
    }
  }

  /**
   * Moderate content
   */
  async moderateContent(text) {
    if (!this.client) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const response = await this.client.moderations.create({
        input: text,
      });

      const result = response.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores,
      };
    } catch (error) {
      logger.error('Content moderation failed:', error);
      throw error;
    }
  }
}

// Singleton instance
const openaiService = new OpenAIService();

export default openaiService;
