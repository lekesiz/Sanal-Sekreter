import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Application configuration
 * Centralized configuration management for all services
 */
const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    websocketPort: parseInt(process.env.WEBSOCKET_PORT, 10) || 3001,
    host: process.env.HOST || '0.0.0.0',
  },

  // Google Cloud Platform
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'europe-west1',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },

  // Google Workspace OAuth
  googleWorkspace: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID,
  },

  // Dialogflow CX
  dialogflow: {
    agentId: process.env.DIALOGFLOW_AGENT_ID,
    location: process.env.DIALOGFLOW_LOCATION || 'europe-west1',
    phoneNumber: process.env.DIALOGFLOW_TELEPHONY_PHONE_NUMBER,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
    model: process.env.OPENAI_MODEL || 'gpt-4o-realtime-preview',
  },

  // Vertex AI
  vertexAI: {
    location: process.env.VERTEX_AI_LOCATION || 'europe-west1',
    model: process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-exp',
  },

  // n8n
  n8n: {
    instanceUrl: process.env.N8N_INSTANCE_URL,
    apiKey: process.env.N8N_API_KEY,
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'sanal_sekreter',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: 2,
      max: 10,
    },
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    piiMaskingEnabled: process.env.PII_MASKING_ENABLED === 'true',
  },

  // Features
  features: {
    enableGmail: process.env.ENABLE_GMAIL_INTEGRATION === 'true',
    enableDrive: process.env.ENABLE_DRIVE_INTEGRATION === 'true',
    enableCalendar: process.env.ENABLE_CALENDAR_INTEGRATION === 'true',
    enableContacts: process.env.ENABLE_CONTACTS_INTEGRATION === 'true',
    enableRAG: process.env.ENABLE_RAG === 'true',
    enableRealtimeLLM: process.env.ENABLE_REALTIME_LLM === 'true',
    enableAgentHandoff: process.env.ENABLE_AGENT_HANDOFF === 'true',
  },

  // RAG Configuration
  rag: {
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    vectorDimension: parseInt(process.env.VECTOR_DIMENSION, 10) || 1536,
    topK: parseInt(process.env.RAG_TOP_K, 10) || 5,
    similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
  },

  // Speech Configuration
  speech: {
    stt: {
      languageCode: process.env.STT_LANGUAGE_CODE || 'tr-TR',
      alternativeLanguage: process.env.STT_ALTERNATIVE_LANGUAGE || 'fr-FR',
      model: 'latest_short',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
    },
    tts: {
      languageCode: process.env.TTS_LANGUAGE_CODE || 'tr-TR',
      voiceName: process.env.TTS_VOICE_NAME || 'tr-TR-Wavenet-E',
      speakingRate: parseFloat(process.env.TTS_SPEAKING_RATE) || 1.0,
      pitch: parseFloat(process.env.TTS_PITCH) || 0.0,
    },
  },

  // Call Routing & SLA
  routing: {
    maxWaitTime: parseInt(process.env.MAX_WAIT_TIME_SECONDS, 10) || 180,
    businessHours: {
      start: process.env.BUSINESS_HOURS_START || '09:00',
      end: process.env.BUSINESS_HOURS_END || '18:00',
      days: process.env.BUSINESS_DAYS?.split(',').map(Number) || [1, 2, 3, 4, 5],
    },
    timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Paris',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: true,
    directory: path.resolve(__dirname, '../../logs'),
  },

  // Monitoring
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableTracing: process.env.ENABLE_TRACING === 'true',
    sentryDsn: process.env.SENTRY_DSN,
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
  },

  // Call Recording
  recording: {
    enabled: process.env.CALL_RECORDING_ENABLED === 'true',
    retentionDays: parseInt(process.env.CALL_RECORDING_RETENTION_DAYS, 10) || 90,
    storageLocation: path.resolve(__dirname, '../../recordings'),
  },
};

// Validation
const requiredConfigs = {
  development: ['gcp.projectId'],
  production: [
    'gcp.projectId',
    'database.url',
    'security.jwtSecret',
    'security.sessionSecret',
  ],
};

const validateConfig = () => {
  const required = requiredConfigs[config.env] || [];
  const missing = [];

  required.forEach((key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    if (!value) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(', ')}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }
};

// Validate on load
if (config.env !== 'test') {
  validateConfig();
}

export default config;
