import { SessionsClient } from '@google-cloud/dialogflow-cx';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Dialogflow CX Service
 * Handles conversational AI and intent detection using Dialogflow CX
 */

class DialogflowService {
  constructor() {
    if (!config.gcp.projectId || !config.dialogflow.agentId) {
      logger.warn('Dialogflow CX not configured');
      this.client = null;
      return;
    }

    try {
      this.client = new SessionsClient({
        keyFilename: config.gcp.credentials,
      });

      this.projectId = config.gcp.projectId;
      this.location = config.dialogflow.location;
      this.agentId = config.dialogflow.agentId;

      logger.info('Dialogflow CX service initialized');
    } catch (error) {
      logger.error('Failed to initialize Dialogflow CX:', error);
      this.client = null;
    }
  }

  /**
   * Create session path
   */
  getSessionPath(sessionId) {
    return this.client.projectLocationAgentSessionPath(
      this.projectId,
      this.location,
      this.agentId,
      sessionId
    );
  }

  /**
   * Detect intent from text
   */
  async detectIntentText(sessionId, text, languageCode = 'fr') {
    if (!this.client) {
      throw new Error('Dialogflow CX not initialized');
    }

    try {
      const sessionPath = this.getSessionPath(sessionId);

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: text,
          },
          languageCode: languageCode,
        },
      };

      const [response] = await this.client.detectIntent(request);

      logger.debug('Dialogflow intent detected', {
        sessionId,
        intent: response.queryResult?.intent?.displayName,
        confidence: response.queryResult?.intentDetectionConfidence,
      });

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Dialogflow intent detection failed:', error);
      throw error;
    }
  }

  /**
   * Detect intent from audio
   */
  async detectIntentAudio(sessionId, audioBuffer, languageCode = 'fr', audioEncoding = 'AUDIO_ENCODING_LINEAR_16', sampleRateHertz = 16000) {
    if (!this.client) {
      throw new Error('Dialogflow CX not initialized');
    }

    try {
      const sessionPath = this.getSessionPath(sessionId);

      const request = {
        session: sessionPath,
        queryInput: {
          audio: {
            config: {
              audioEncoding: audioEncoding,
              sampleRateHertz: sampleRateHertz,
              languageCode: languageCode,
            },
            audio: audioBuffer,
          },
        },
      };

      const [response] = await this.client.detectIntent(request);

      return this.parseResponse(response);
    } catch (error) {
      logger.error('Dialogflow audio intent detection failed:', error);
      throw error;
    }
  }

  /**
   * Streaming detect intent (for real-time audio)
   */
  async detectIntentStream(sessionId, languageCode = 'fr') {
    if (!this.client) {
      throw new Error('Dialogflow CX not initialized');
    }

    const sessionPath = this.getSessionPath(sessionId);

    const initialStreamRequest = {
      session: sessionPath,
      queryInput: {
        audio: {
          config: {
            audioEncoding: 'AUDIO_ENCODING_LINEAR_16',
            sampleRateHertz: 16000,
            languageCode: languageCode,
          },
        },
      },
    };

    const stream = this.client.streamingDetectIntent();

    return {
      stream,
      initialRequest: initialStreamRequest,
    };
  }

  /**
   * Parse Dialogflow response
   */
  parseResponse(response) {
    const queryResult = response.queryResult;

    return {
      responseId: response.responseId,
      intent: {
        displayName: queryResult.intent?.displayName,
        confidence: queryResult.intentDetectionConfidence,
        isFallback: queryResult.intent?.isFallback,
      },
      transcript: queryResult.transcript,
      text: queryResult.text,
      languageCode: queryResult.languageCode,
      parameters: queryResult.parameters,
      fulfillmentText: queryResult.responseMessages
        ?.map(msg => msg.text?.text)
        .flat()
        .filter(Boolean)
        .join(' '),
      responseMessages: queryResult.responseMessages,
      webhookPayloads: queryResult.webhookPayloads,
      currentPage: queryResult.currentPage?.displayName,
      diagnosticInfo: queryResult.diagnosticInfo,
    };
  }

  /**
   * Fulfill webhook from Dialogflow
   */
  async fulfillWebhook(request) {
    try {
      const { sessionInfo, fulfillmentInfo, text, languageCode } = request;

      logger.debug('Dialogflow webhook received', {
        tag: fulfillmentInfo?.tag,
        text,
        languageCode,
      });

      // Process based on tag
      let fulfillmentResponse = {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Response from webhook'],
              },
            },
          ],
        },
      };

      // Custom webhook logic here
      switch (fulfillmentInfo?.tag) {
        case 'get-business-hours':
          fulfillmentResponse = await this.handleBusinessHoursIntent();
          break;

        case 'get-services':
          fulfillmentResponse = await this.handleServicesIntent();
          break;

        case 'schedule-appointment':
          fulfillmentResponse = await this.handleScheduleIntent(request.parameters);
          break;

        default:
          logger.warn('Unknown webhook tag:', fulfillmentInfo?.tag);
      }

      return fulfillmentResponse;
    } catch (error) {
      logger.error('Webhook fulfillment error:', error);
      throw error;
    }
  }

  /**
   * Handle business hours intent
   */
  async handleBusinessHoursIntent() {
    const message = {
      'fr': 'Nous sommes ouverts du lundi au vendredi, de 9h à 18h.',
      'tr': 'Pazartesiden Cumaya, saat 09:00 - 18:00 arası açığız.',
    };

    return {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [message['fr']],
            },
          },
        ],
      },
    };
  }

  /**
   * Handle services intent
   */
  async handleServicesIntent() {
    const message = {
      'fr': 'Nous proposons: réparation d\'ordinateurs, conseil IT, configuration réseau, récupération de données, installation de logiciels, et montage de PC sur mesure.',
      'tr': 'Sunduğumuz hizmetler: Bilgisayar tamiri, IT danışmanlığı, ağ kurulumu, veri kurtarma, yazılım kurulumu ve özel PC montajı.',
    };

    return {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [message['fr']],
            },
          },
        ],
      },
    };
  }

  /**
   * Handle schedule appointment intent
   */
  async handleScheduleIntent(parameters) {
    // This would integrate with Google Calendar API
    const date = parameters?.date;
    const time = parameters?.time;

    return {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [`Je note votre rendez-vous pour le ${date} à ${time}.`],
            },
          },
        ],
      },
    };
  }

  /**
   * List all intents in agent
   */
  async listIntents() {
    if (!this.client) {
      throw new Error('Dialogflow CX not initialized');
    }

    try {
      const { IntentsClient } = await import('@google-cloud/dialogflow-cx');
      const intentsClient = new IntentsClient({
        keyFilename: config.gcp.credentials,
      });

      const agentPath = `projects/${this.projectId}/locations/${this.location}/agents/${this.agentId}`;

      const [intents] = await intentsClient.listIntents({
        parent: agentPath,
      });

      return intents;
    } catch (error) {
      logger.error('Failed to list intents:', error);
      throw error;
    }
  }

  /**
   * Create test case
   */
  async createTestCase(testCase) {
    try {
      const { TestCasesClient } = await import('@google-cloud/dialogflow-cx');
      const testCasesClient = new TestCasesClient({
        keyFilename: config.gcp.credentials,
      });

      const agentPath = `projects/${this.projectId}/locations/${this.location}/agents/${this.agentId}`;

      const [response] = await testCasesClient.createTestCase({
        parent: agentPath,
        testCase,
      });

      logger.info('Test case created', { testCaseId: response.name });
      return response;
    } catch (error) {
      logger.error('Failed to create test case:', error);
      throw error;
    }
  }
}

// Singleton instance
const dialogflowService = new DialogflowService();

export default dialogflowService;
