import textToSpeech from '@google-cloud/text-to-speech';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Text-to-Speech Service
 * Convert text to audio using Google Cloud Text-to-Speech
 */

class TTSService {
  constructor() {
    if (!config.gcp.credentials) {
      logger.warn('GCP credentials not configured, TTS service disabled');
      this.client = null;
      return;
    }

    this.client = new textToSpeech.TextToSpeechClient({
      keyFilename: config.gcp.credentials,
    });

    this.config = config.speech.tts;
    logger.info('TTS service initialized', this.config);
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(text, options = {}) {
    if (!this.client) {
      throw new Error('TTS service not initialized');
    }

    try {
      const {
        languageCode = this.config.languageCode,
        voiceName = this.config.voiceName,
        speakingRate = this.config.speakingRate,
        pitch = this.config.pitch,
        audioEncoding = 'MP3',
      } = options;

      const request = {
        input: { text },
        voice: {
          languageCode: languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: audioEncoding,
          speakingRate: speakingRate,
          pitch: pitch,
        },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      logger.debug('Speech synthesized', {
        textLength: text.length,
        voiceName,
        languageCode,
        audioSize: response.audioContent.length,
      });

      return response.audioContent;
    } catch (error) {
      logger.error('TTS synthesis failed:', error);
      throw error;
    }
  }

  /**
   * Synthesize with SSML (Speech Synthesis Markup Language)
   */
  async synthesizeSSML(ssml, options = {}) {
    if (!this.client) {
      throw new Error('TTS service not initialized');
    }

    try {
      const {
        languageCode = this.config.languageCode,
        voiceName = this.config.voiceName,
        audioEncoding = 'MP3',
      } = options;

      const request = {
        input: { ssml },
        voice: {
          languageCode: languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: audioEncoding,
        },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      logger.debug('SSML speech synthesized', {
        ssmlLength: ssml.length,
        voiceName,
      });

      return response.audioContent;
    } catch (error) {
      logger.error('SSML synthesis failed:', error);
      throw error;
    }
  }

  /**
   * List available voices
   */
  async listVoices(languageCode = null) {
    if (!this.client) {
      throw new Error('TTS service not initialized');
    }

    try {
      const request = languageCode ? { languageCode } : {};
      const [response] = await this.client.listVoices(request);

      return response.voices.map(voice => ({
        name: voice.name,
        languageCodes: voice.languageCodes,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
      }));
    } catch (error) {
      logger.error('Failed to list voices:', error);
      throw error;
    }
  }

  /**
   * Get voice by language and gender
   */
  async getVoiceForLanguage(languageCode, gender = 'NEUTRAL') {
    const voices = await this.listVoices(languageCode);

    const match = voices.find(
      voice =>
        voice.languageCodes.includes(languageCode) &&
        voice.ssmlGender === gender
    );

    return match?.name || voices[0]?.name;
  }

  /**
   * Create SSML with break/pause
   */
  createSSMLWithPauses(text, pauseDuration = '500ms') {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    const ssmlParts = sentences.map(
      sentence => `${sentence.trim()}.<break time="${pauseDuration}"/>`
    );

    return `<speak>${ssmlParts.join(' ')}</speak>`;
  }

  /**
   * Synthesize for phone (optimized for telephony)
   */
  async synthesizeForPhone(text, languageCode = 'fr-FR') {
    return this.synthesize(text, {
      languageCode,
      voiceName: languageCode === 'tr-TR' ? 'tr-TR-Wavenet-E' : 'fr-FR-Wavenet-E',
      audioEncoding: 'MULAW',
      speakingRate: 1.0,
      pitch: 0.0,
    });
  }
}

// Singleton instance
const ttsService = new TTSService();

export default ttsService;
