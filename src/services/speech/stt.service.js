import speech from '@google-cloud/speech';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Speech-to-Text Service
 * Convert audio to text using Google Cloud Speech-to-Text
 */

class STTService {
  constructor() {
    if (!config.gcp.credentials) {
      logger.warn('GCP credentials not configured, STT service disabled');
      this.client = null;
      return;
    }

    this.client = new speech.SpeechClient({
      keyFilename: config.gcp.credentials,
    });

    this.config = config.speech.stt;
    logger.info('STT service initialized', this.config);
  }

  /**
   * Transcribe audio buffer
   */
  async transcribe(audioBuffer, options = {}) {
    if (!this.client) {
      throw new Error('STT service not initialized');
    }

    try {
      const {
        languageCode = this.config.languageCode,
        encoding = 'LINEAR16',
        sampleRateHertz = 16000,
        audioChannelCount = 1,
      } = options;

      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: encoding,
          sampleRateHertz: sampleRateHertz,
          audioChannelCount: audioChannelCount,
          languageCode: languageCode,
          alternativeLanguageCodes: [this.config.alternativeLanguage],
          model: this.config.model,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          enableWordTimeOffsets: this.config.enableWordTimeOffsets,
        },
      };

      const [response] = await this.client.recognize(request);

      const transcriptions = response.results.map(result => ({
        transcript: result.alternatives[0].transcript,
        confidence: result.alternatives[0].confidence,
        words: result.alternatives[0].words,
        languageCode: result.languageCode,
      }));

      logger.debug('Audio transcribed', {
        languageCode,
        transcriptLength: transcriptions[0]?.transcript?.length,
        confidence: transcriptions[0]?.confidence,
      });

      return transcriptions;
    } catch (error) {
      logger.error('STT transcription failed:', error);
      throw error;
    }
  }

  /**
   * Create streaming recognize stream
   */
  createStreamingRecognize(options = {}) {
    if (!this.client) {
      throw new Error('STT service not initialized');
    }

    const {
      languageCode = this.config.languageCode,
      encoding = 'LINEAR16',
      sampleRateHertz = 16000,
      singleUtterance = false,
      interimResults = true,
    } = options;

    const request = {
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        alternativeLanguageCodes: [this.config.alternativeLanguage],
        model: 'phone_call',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
      },
      interimResults: interimResults,
      singleUtterance: singleUtterance,
    };

    const stream = this.client.streamingRecognize(request);

    logger.debug('STT streaming started', { languageCode, encoding });

    return stream;
  }

  /**
   * Transcribe audio file from URL
   */
  async transcribeFile(gcsUri, options = {}) {
    if (!this.client) {
      throw new Error('STT service not initialized');
    }

    try {
      const {
        languageCode = this.config.languageCode,
        encoding = 'LINEAR16',
        sampleRateHertz = 16000,
      } = options;

      const request = {
        audio: {
          uri: gcsUri,
        },
        config: {
          encoding: encoding,
          sampleRateHertz: sampleRateHertz,
          languageCode: languageCode,
          model: this.config.model,
          enableAutomaticPunctuation: true,
        },
      };

      const [operation] = await this.client.longRunningRecognize(request);
      const [response] = await operation.promise();

      const transcriptions = response.results.map(result => ({
        transcript: result.alternatives[0].transcript,
        confidence: result.alternatives[0].confidence,
      }));

      logger.info('File transcribed', {
        gcsUri,
        transcriptLength: transcriptions.length,
      });

      return transcriptions;
    } catch (error) {
      logger.error('File transcription failed:', error);
      throw error;
    }
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioBuffer) {
    if (!this.client) {
      throw new Error('STT service not initialized');
    }

    try {
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'auto', // Auto-detect
        },
      };

      const [response] = await this.client.recognize(request);

      if (response.results && response.results.length > 0) {
        return response.results[0].languageCode;
      }

      return null;
    } catch (error) {
      logger.error('Language detection failed:', error);
      return null;
    }
  }
}

// Singleton instance
const sttService = new STTService();

export default sttService;
