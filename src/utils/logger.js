import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

// Create logs directory if it doesn't exist
if (!fs.existsSync(config.logging.directory)) {
  fs.mkdirSync(config.logging.directory, { recursive: true });
}

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format (colored and readable)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return msg;
  })
);

/**
 * Create transports based on configuration
 */
const transports = [];

// Console transport
if (config.logging.enableConsole) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: config.logging.level,
    })
  );
}

// File transports
if (config.logging.enableFile) {
  // General application logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.directory, 'app.log'),
      format: logFormat,
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.directory, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Call logs (separate file for call-related events)
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.directory, 'calls.log'),
      format: logFormat,
      level: 'debug',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'sanal-sekreter',
    environment: config.env,
  },
  transports,
  exitOnError: false,
});

/**
 * Stream for Morgan HTTP logger
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

/**
 * Log call events with structured data
 */
logger.logCall = (eventType, callData) => {
  logger.info('Call Event', {
    eventType,
    callId: callData.callId,
    from: callData.from,
    to: callData.to,
    duration: callData.duration,
    status: callData.status,
    intent: callData.intent,
    timestamp: new Date().toISOString(),
    ...callData,
  });
};

/**
 * Log RAG queries
 */
logger.logRAG = (query, results, metadata = {}) => {
  logger.debug('RAG Query', {
    query,
    resultsCount: results?.length || 0,
    topScore: results?.[0]?.score,
    sources: results?.map(r => r.source),
    ...metadata,
  });
};

/**
 * Log LLM interactions
 */
logger.logLLM = (model, prompt, response, metadata = {}) => {
  logger.debug('LLM Interaction', {
    model,
    promptLength: prompt?.length,
    responseLength: response?.length,
    tokensUsed: metadata.tokensUsed,
    latency: metadata.latency,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log security events
 */
logger.logSecurity = (eventType, details) => {
  logger.warn('Security Event', {
    eventType,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

/**
 * Log performance metrics
 */
logger.logMetric = (metricName, value, unit = 'ms', metadata = {}) => {
  logger.info('Metric', {
    metric: metricName,
    value,
    unit,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

/**
 * Create child logger with additional context
 */
logger.child = (context) => {
  return logger.child(context);
};

export default logger;
