import twilio from 'twilio';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Twilio Telephony Service
 * Handles all Twilio-related operations for voice calls
 */

class TwilioService {
  constructor() {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      logger.warn('Twilio credentials not configured');
      this.client = null;
      return;
    }

    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    this.VoiceResponse = twilio.twiml.VoiceResponse;
    logger.info('Twilio service initialized');
  }

  /**
   * Create a TwiML response for incoming call
   */
  createGreetingResponse(language = 'fr-FR') {
    const twiml = new this.VoiceResponse();

    const greetings = {
      'fr-FR': 'Bonjour, bienvenue chez NETZ Informatique. Veuillez patienter pendant que nous analysons votre demande.',
      'tr-TR': 'Merhaba, NETZ Informatique\'e hoş geldiniz. Talebinizi analiz ederken lütfen bekleyin.',
    };

    // Greeting
    twiml.say(
      {
        voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
        language: language,
      },
      greetings[language] || greetings['fr-FR']
    );

    // Start gathering speech
    const gather = twiml.gather({
      input: 'speech',
      language: language,
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      action: '/api/webhooks/twilio/speech',
      method: 'POST',
    });

    gather.say(
      {
        voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
        language: language,
      },
      language === 'tr-TR'
        ? 'Size nasıl yardımcı olabilirim?'
        : 'Comment puis-je vous aider?'
    );

    // If no input, repeat
    twiml.redirect('/api/webhooks/twilio/voice');

    return twiml.toString();
  }

  /**
   * Create response based on intent
   */
  createIntentResponse(intent, text, language = 'fr-FR') {
    const twiml = new this.VoiceResponse();

    // Speak the response
    twiml.say(
      {
        voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
        language: language,
      },
      text
    );

    // Based on intent, decide next action
    if (intent.requiresHandoff) {
      // Transfer to agent
      twiml.say(
        {
          voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
          language: language,
        },
        language === 'tr-TR'
          ? 'Sizi bir temsilciye bağlıyorum.'
          : 'Je vous transfère à un agent.'
      );

      twiml.dial({
        action: '/api/webhooks/twilio/dial-status',
        timeout: 30,
      }, config.twilio.phoneNumber); // Replace with agent's number

    } else {
      // Continue conversation
      const gather = twiml.gather({
        input: 'speech',
        language: language,
        speechTimeout: 'auto',
        action: '/api/webhooks/twilio/speech',
        method: 'POST',
      });

      gather.say(
        {
          voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
          language: language,
        },
        language === 'tr-TR'
          ? 'Başka bir konuda yardımcı olabilir miyim?'
          : 'Puis-je vous aider avec autre chose?'
      );
    }

    return twiml.toString();
  }

  /**
   * Create hold music/message
   */
  createHoldResponse(language = 'fr-FR') {
    const twiml = new this.VoiceResponse();

    twiml.say(
      {
        voice: language === 'tr-TR' ? 'Polly.Filiz' : 'Polly.Celine',
        language: language,
      },
      language === 'tr-TR'
        ? 'Lütfen hatta kalın, sizi bir temsilciye bağlıyoruz.'
        : 'Veuillez patienter, nous vous mettons en relation avec un agent.'
    );

    // Add hold music (optional)
    twiml.play({
      loop: 5,
    }, 'https://your-domain.com/hold-music.mp3');

    return twiml.toString();
  }

  /**
   * Initiate outbound call
   */
  async makeCall(to, from = config.twilio.phoneNumber, options = {}) {
    try {
      const call = await this.client.calls.create({
        to,
        from,
        url: options.twimlUrl || `${config.server.publicUrl}/api/webhooks/twilio/outbound`,
        statusCallback: `${config.server.publicUrl}/api/webhooks/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: options.record || false,
        ...options,
      });

      logger.logCall('outbound_initiated', {
        callSid: call.sid,
        to,
        from,
      });

      return call;
    } catch (error) {
      logger.error('Failed to make outbound call:', error);
      throw error;
    }
  }

  /**
   * Get call details
   */
  async getCall(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      logger.error(`Failed to fetch call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Update call (e.g., redirect, hangup)
   */
  async updateCall(callSid, updates) {
    try {
      const call = await this.client.calls(callSid).update(updates);
      logger.info(`Call ${callSid} updated`, updates);
      return call;
    } catch (error) {
      logger.error(`Failed to update call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Hang up a call
   */
  async hangupCall(callSid) {
    return this.updateCall(callSid, { status: 'completed' });
  }

  /**
   * Get call recordings
   */
  async getRecordings(callSid) {
    try {
      const recordings = await this.client.recordings.list({
        callSid,
        limit: 20,
      });

      return recordings;
    } catch (error) {
      logger.error(`Failed to fetch recordings for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Start recording
   */
  async startRecording(callSid) {
    try {
      const recording = await this.client.calls(callSid)
        .recordings
        .create({
          recordingStatusCallback: `${config.server.publicUrl}/api/webhooks/twilio/recording-status`,
        });

      logger.info(`Recording started for call ${callSid}`, {
        recordingSid: recording.sid,
      });

      return recording;
    } catch (error) {
      logger.error(`Failed to start recording for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket for media streaming
   */
  createMediaStreamResponse(websocketUrl) {
    const twiml = new this.VoiceResponse();

    twiml.say('Connecting to AI assistant');

    const start = twiml.start();
    start.stream({
      url: websocketUrl,
      track: 'both_tracks',
    });

    twiml.pause({
      length: 60,
    });

    return twiml.toString();
  }

  /**
   * Validate Twilio webhook signature
   */
  validateRequest(url, params, signature) {
    return twilio.validateRequest(
      config.twilio.authToken,
      signature,
      url,
      params
    );
  }

  /**
   * Create conference
   */
  async createConference(friendlyName, options = {}) {
    try {
      const conference = await this.client.conferences.create({
        friendlyName,
        statusCallback: `${config.server.publicUrl}/api/webhooks/twilio/conference-status`,
        statusCallbackEvent: ['start', 'end', 'join', 'leave'],
        ...options,
      });

      logger.info('Conference created', {
        conferenceSid: conference.sid,
        friendlyName,
      });

      return conference;
    } catch (error) {
      logger.error('Failed to create conference:', error);
      throw error;
    }
  }

  /**
   * Add participant to conference
   */
  createConferenceResponse(conferenceName, options = {}) {
    const twiml = new this.VoiceResponse();

    const dial = twiml.dial({
      action: '/api/webhooks/twilio/conference-end',
    });

    dial.conference({
      startConferenceOnEnter: options.startOnEnter || true,
      endConferenceOnExit: options.endOnExit || false,
      waitUrl: options.waitUrl || 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical',
      statusCallback: `${config.server.publicUrl}/api/webhooks/twilio/participant-status`,
      statusCallbackEvent: ['join', 'leave'],
    }, conferenceName);

    return twiml.toString();
  }

  /**
   * Get available phone numbers
   */
  async getAvailableNumbers(countryCode = 'FR', options = {}) {
    try {
      const numbers = await this.client.availablePhoneNumbers(countryCode)
        .local
        .list({
          limit: 20,
          ...options,
        });

      return numbers;
    } catch (error) {
      logger.error('Failed to fetch available numbers:', error);
      throw error;
    }
  }
}

// Singleton instance
const twilioService = new TwilioService();

export default twilioService;
