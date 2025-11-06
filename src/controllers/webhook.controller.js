import twilioService from '../services/telephony/twilio.service.js';
import dialogflowService from '../services/telephony/dialogflow.service.js';
import logger from '../utils/logger.js';
import { normalizePhoneNumber } from '../utils/security.js';

/**
 * Webhook Controllers
 * Handle incoming webhooks from Twilio and Dialogflow
 */

/**
 * Twilio Voice Webhook - Initial call
 */
export const twilioVoiceWebhook = async (req, res) => {
  try {
    const { CallSid, From, To, CallStatus } = req.body;

    logger.logCall('inbound_call', {
      callSid: CallSid,
      from: From,
      to: To,
      status: CallStatus,
    });

    // TODO: Save call to database
    // TODO: Detect language from caller's location or previous calls

    const language = 'fr-FR'; // Default to French

    // Create greeting TwiML response
    const twiml = twilioService.createGreetingResponse(language);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Twilio voice webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Twilio Speech Webhook - Handle speech input
 */
export const twilioSpeechWebhook = async (req, res) => {
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;

    logger.info('Speech received', {
      callSid: CallSid,
      text: SpeechResult,
      confidence: Confidence,
    });

    // TODO: Process speech with LLM/Intent detector
    // TODO: Query RAG system for relevant information
    // TODO: Determine if handoff is needed

    // For now, create a simple response
    const intent = {
      requiresHandoff: false,
    };

    const responseText = 'Je comprends votre demande. Permettez-moi de vérifier nos informations.';
    const language = 'fr-FR';

    const twiml = twilioService.createIntentResponse(intent, responseText, language);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Twilio speech webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Twilio Status Callback - Call status updates
 */
export const twilioStatusWebhook = async (req, res) => {
  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl,
      RecordingDuration,
    } = req.body;

    logger.logCall('call_status_update', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      recordingUrl: RecordingUrl,
    });

    // TODO: Update call in database
    // TODO: Trigger post-call analysis if completed

    res.sendStatus(200);
  } catch (error) {
    logger.error('Twilio status webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Twilio Dial Status Webhook - Agent dial status
 */
export const twilioDialStatusWebhook = async (req, res) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration } = req.body;

    logger.info('Dial status', {
      callSid: CallSid,
      dialStatus: DialCallStatus,
      duration: DialCallDuration,
    });

    const twiml = new twilioService.VoiceResponse();

    if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy') {
      twiml.say(
        {
          voice: 'Polly.Celine',
          language: 'fr-FR',
        },
        'Désolé, aucun agent n\'est disponible pour le moment. Veuillez rappeler plus tard ou laisser un message.'
      );

      // TODO: Offer voicemail or callback option
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Twilio dial status webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Twilio Recording Status Webhook
 */
export const twilioRecordingStatusWebhook = async (req, res) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingStatus } = req.body;

    logger.info('Recording status', {
      callSid: CallSid,
      recordingSid: RecordingSid,
      status: RecordingStatus,
      url: RecordingUrl,
    });

    // TODO: Save recording URL to database
    // TODO: Trigger transcription job

    res.sendStatus(200);
  } catch (error) {
    logger.error('Twilio recording status webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Twilio Conference Status Webhook
 */
export const twilioConferenceStatusWebhook = async (req, res) => {
  try {
    const {
      ConferenceSid,
      FriendlyName,
      StatusCallbackEvent,
      Timestamp,
    } = req.body;

    logger.info('Conference status', {
      conferenceSid: ConferenceSid,
      event: StatusCallbackEvent,
      timestamp: Timestamp,
    });

    res.sendStatus(200);
  } catch (error) {
    logger.error('Twilio conference status webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * Dialogflow Webhook - Fulfill intents
 */
export const dialogflowWebhook = async (req, res) => {
  try {
    const request = req.body;

    logger.debug('Dialogflow webhook request', {
      session: request.sessionInfo?.session,
      tag: request.fulfillmentInfo?.tag,
    });

    const response = await dialogflowService.fulfillWebhook(request);

    res.json(response);
  } catch (error) {
    logger.error('Dialogflow webhook error:', error);

    // Return error response in Dialogflow format
    res.json({
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: ['Désolé, une erreur s\'est produite. Veuillez réessayer.'],
            },
          },
        ],
      },
    });
  }
};

/**
 * Twilio Media Stream WebSocket Handler
 * For real-time audio streaming
 */
export const handleMediaStream = (ws, req) => {
  logger.info('Media stream connected', {
    callSid: req.query.callSid,
  });

  let streamSid = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          streamSid = data.start.streamSid;
          logger.debug('Media stream started', {
            streamSid,
            callSid: data.start.callSid,
          });
          break;

        case 'media':
          // Process audio chunk
          const audioChunk = Buffer.from(data.media.payload, 'base64');

          // TODO: Send to STT service
          // TODO: Process with LLM
          // TODO: Send TTS response back

          break;

        case 'stop':
          logger.debug('Media stream stopped', { streamSid });
          break;

        default:
          logger.warn('Unknown media stream event:', data.event);
      }
    } catch (error) {
      logger.error('Media stream error:', error);
    }
  });

  ws.on('close', () => {
    logger.info('Media stream closed', { streamSid });
  });

  ws.on('error', (error) => {
    logger.error('Media stream WebSocket error:', error);
  });
};

export default {
  twilioVoiceWebhook,
  twilioSpeechWebhook,
  twilioStatusWebhook,
  twilioDialStatusWebhook,
  twilioRecordingStatusWebhook,
  twilioConferenceStatusWebhook,
  dialogflowWebhook,
  handleMediaStream,
};
