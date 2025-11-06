import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import logger from './utils/logger.js';

/**
 * NETZ Sanal Sekreter - Main Application Entry Point
 * AI-powered virtual secretary with Google Voice integration
 */

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.security.allowedOrigins,
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes (will be added in next steps)
app.get('/api', (req, res) => {
  res.json({
    message: 'NETZ Sanal Sekreter API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      calls: '/api/calls',
      webhooks: '/api/webhooks',
      admin: '/api/admin',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(config.isDevelopment && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      path: req.path,
    },
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connections
    // Close Redis connections
    // Close WebSocket connections

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(
    `🤖 NETZ Sanal Sekreter started on ${config.server.host}:${config.server.port}`,
    {
      environment: config.env,
      features: {
        gmail: config.features.enableGmail,
        drive: config.features.enableDrive,
        calendar: config.features.enableCalendar,
        rag: config.features.enableRAG,
        realtimeLLM: config.features.enableRealtimeLLM,
      },
    }
  );
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

export default app;
