/**
 * Express application setup
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import uploadRoutes from './routes/uploadRoutes';
import { initDatabase } from './config/database';
import { initStorage } from './config/storage';

export async function createApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.server.nodeEnv === 'production' 
      ? process.env.CORS_ORIGIN?.split(',') || []
      : '*',
    credentials: true,
  }));

  // Body parsing
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
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API routes
  app.use('/api/upload', apiLimiter, uploadRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

export async function initializeApp(): Promise<void> {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Initialize storage
    await initStorage();
    logger.info('Storage initialized');
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}

