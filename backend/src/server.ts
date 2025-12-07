/**
 * Server entry point
 */

import { createApp, initializeApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { closeDatabase } from './config/database';
import { closeRedis } from './config/redis';

async function startServer(): Promise<void> {
  try {
    // Initialize application (database, storage, etc.)
    await initializeApp();

    // Create Express app
    const app = await createApp();

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`, {
        environment: config.server.nodeEnv,
        port: config.server.port,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await closeDatabase();
          await closeRedis();
          logger.info('Cleanup complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      shutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();

