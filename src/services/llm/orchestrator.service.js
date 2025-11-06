import openaiService from './openai.service.js';
import ragService from '../rag/rag.service.js';
import gmailService from '../google-workspace/gmail.service.js';
import calendarService from '../google-workspace/calendar.service.js';
import contactsService from '../google-workspace/contacts.service.js';
import logger from '../../utils/logger.js';
import { isBusinessHours } from '../../utils/helpers.js';

/**
 * LLM Orchestrator Service
 * Main AI orchestration for the virtual secretary
 * Coordinates between LLM, RAG, and Google Workspace services
 */

class OrchestratorService {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
    this.conversationHistory = new Map(); // callId -> messages[]
    logger.info('LLM Orchestrator initialized');
  }

  /**
   * Build system prompt for the virtual secretary
   */
  buildSystemPrompt() {
    return `You are an AI virtual secretary for NETZ Informatique, a computer repair and IT services company in France.

Your role:
- Greet callers professionally in French or Turkish
- Understand their needs and provide helpful information
- Access company knowledge base for accurate answers
- Check availability and suggest appointments
- Transfer to human agents when necessary

Guidelines:
- Be polite, professional, and helpful
- Speak naturally and conversationally
- If you don't know something, say so and offer to transfer to an agent
- Always cite sources when using knowledge base information
- Protect customer privacy - never share personal information
- Keep responses concise (2-3 sentences max for phone conversations)

Available tools:
- knowledge_base: Search company documents
- check_calendar: Check availability for appointments
- search_contacts: Find contact information
- check_email: Search recent emails (with permission)
- transfer_agent: Transfer to human agent

Business hours: Monday-Friday, 9:00 AM - 6:00 PM (Paris time)
Outside business hours, offer to take a message or schedule a callback.`;
  }

  /**
   * Process incoming call and generate response
   */
  async processCall(callId, userInput, context = {}) {
    try {
      logger.info('Processing call', {
        callId,
        userInput: userInput.substring(0, 100),
      });

      // Get or create conversation history
      if (!this.conversationHistory.has(callId)) {
        this.conversationHistory.set(callId, [
          {
            role: 'system',
            content: this.systemPrompt,
          },
        ]);
      }

      const messages = this.conversationHistory.get(callId);

      // Add user message
      messages.push({
        role: 'user',
        content: userInput,
      });

      // Detect intent and gather context
      const intent = await this.detectIntent(userInput, context);

      // Gather relevant information based on intent
      const toolResults = await this.gatherContext(intent, userInput, context);

      // Build enhanced prompt with context
      let enhancedPrompt = userInput;

      if (toolResults.length > 0) {
        enhancedPrompt += '\n\nContext:\n';
        toolResults.forEach(result => {
          enhancedPrompt += `- ${result.tool}: ${result.summary}\n`;
        });
      }

      // Add business hours context
      const isOpen = isBusinessHours();
      enhancedPrompt += `\n\nCurrent status: ${isOpen ? 'Business is OPEN' : 'Business is CLOSED'}`;

      // Get LLM response
      const response = await openaiService.generateResponse(messages, {
        enhancedPrompt,
        intent,
        tools: this.getAvailableTools(),
      });

      // Add assistant message to history
      messages.push({
        role: 'assistant',
        content: response.message,
      });

      // Determine if handoff is needed
      const needsHandoff = this.shouldHandoff(intent, response, toolResults);

      const result = {
        callId,
        intent: intent.name,
        confidence: intent.confidence,
        response: response.message,
        needsHandoff,
        handoffReason: needsHandoff ? this.getHandoffReason(intent, response) : null,
        toolsUsed: toolResults.map(t => t.tool),
        context: {
          isBusinessHours: isOpen,
          conversationTurns: messages.filter(m => m.role !== 'system').length / 2,
        },
      };

      logger.info('Call processed', {
        callId,
        intent: result.intent,
        needsHandoff,
      });

      return result;
    } catch (error) {
      logger.error('Call processing failed:', error);
      throw error;
    }
  }

  /**
   * Detect intent from user input
   */
  async detectIntent(text, context = {}) {
    // Use simple keyword matching for now
    // In production, use Dialogflow or fine-tuned model
    const intents = {
      business_hours: ['heures', 'ouvert', 'horaires', 'açık', 'saat', 'hours', 'open'],
      services: ['service', 'réparation', 'repair', 'tamir', 'hizmet'],
      appointment: ['rendez-vous', 'appointment', 'randevu', 'réserver', 'book'],
      technical_support: ['problème', 'problem', 'sorun', 'bug', 'error', 'panne'],
      pricing: ['prix', 'tarif', 'cost', 'price', 'fiyat'],
      location: ['adresse', 'où', 'location', 'address', 'adres', 'nerede'],
      contact: ['contact', 'email', 'téléphone', 'phone', 'iletişim'],
      agent_request: ['agent', 'personne', 'human', 'temsilci', 'insan'],
    };

    let detectedIntent = 'general_inquiry';
    let maxMatches = 0;

    const lowerText = text.toLowerCase();

    for (const [intent, keywords] of Object.entries(intents)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        detectedIntent = intent;
      }
    }

    return {
      name: detectedIntent,
      confidence: Math.min(maxMatches * 0.3, 0.95),
      keywords: intents[detectedIntent] || [],
    };
  }

  /**
   * Gather context using available tools
   */
  async gatherContext(intent, query, context = {}) {
    const results = [];

    try {
      // Always search knowledge base for relevant information
      if (intent.name !== 'agent_request') {
        const ragResults = await ragService.query(query, {
          topK: 3,
          accessLevel: context.accessLevel || 'public',
        });

        if (ragResults.hasResults) {
          results.push({
            tool: 'knowledge_base',
            summary: `Found ${ragResults.results.length} relevant documents`,
            data: ragResults.results,
          });
        }
      }

      // For appointment intent, check calendar
      if (intent.name === 'appointment') {
        const today = new Date();
        const slots = await calendarService.findAvailableSlots(today, 60);

        results.push({
          tool: 'check_calendar',
          summary: `${slots.length} available time slots today`,
          data: slots.slice(0, 3), // Top 3 slots
        });
      }

      // For contact queries, search contacts by phone
      if (context.fromNumber && intent.confidence > 0.5) {
        const contact = await contactsService.getContactByPhone(context.fromNumber);

        if (contact) {
          results.push({
            tool: 'search_contacts',
            summary: `Caller identified: ${contact.displayName}`,
            data: contact,
          });
        }
      }
    } catch (error) {
      logger.error('Error gathering context:', error);
    }

    return results;
  }

  /**
   * Determine if call should be handed off to agent
   */
  shouldHandoff(intent, response, toolResults) {
    // Always handoff if explicitly requested
    if (intent.name === 'agent_request') {
      return true;
    }

    // Handoff if low confidence
    if (intent.confidence < 0.3) {
      return true;
    }

    // Handoff for technical support during business hours
    if (intent.name === 'technical_support' && isBusinessHours()) {
      return true;
    }

    // Handoff if no relevant knowledge base results
    const hasKnowledge = toolResults.some(t => t.tool === 'knowledge_base');
    if (!hasKnowledge && intent.name !== 'general_inquiry') {
      return true;
    }

    return false;
  }

  /**
   * Get handoff reason
   */
  getHandoffReason(intent, response) {
    const reasons = {
      agent_request: 'Customer requested human agent',
      technical_support: 'Technical support requires specialist',
      low_confidence: 'Unable to understand request clearly',
      no_knowledge: 'Information not available in knowledge base',
    };

    return reasons[intent.name] || 'Customer needs personalized assistance';
  }

  /**
   * Get available tools definition for LLM
   */
  getAvailableTools() {
    return [
      {
        name: 'knowledge_base',
        description: 'Search company knowledge base for information',
        parameters: {
          query: 'string',
        },
      },
      {
        name: 'check_calendar',
        description: 'Check calendar availability',
        parameters: {
          date: 'string',
          duration: 'number',
        },
      },
      {
        name: 'transfer_agent',
        description: 'Transfer call to human agent',
        parameters: {
          reason: 'string',
        },
      },
    ];
  }

  /**
   * Clear conversation history for a call
   */
  clearHistory(callId) {
    this.conversationHistory.delete(callId);
    logger.debug('Conversation history cleared', { callId });
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(callId) {
    const messages = this.conversationHistory.get(callId);

    if (!messages) {
      return null;
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    return {
      turns: userMessages.length,
      userMessages: userMessages.map(m => m.content),
      assistantMessages: assistantMessages.map(m => m.content),
    };
  }
}

// Singleton instance
const orchestratorService = new OrchestratorService();

export default orchestratorService;
