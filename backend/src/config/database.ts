/**
 * PostgreSQL database connection and setup
 */

import { Pool, PoolClient } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
    });

    pool.on('connect', () => {
      logger.info('Database connection established');
    });
  }

  return pool;
}

export async function initDatabase(): Promise<void> {
  const client = await getPool().connect();

  try {
    // Create uploads table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        upload_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        file_name VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        checksum VARCHAR(255),
        total_chunks INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'INIT',
        file_path VARCHAR(1000),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // Create index on status for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status)
    `);

    // Create index on user_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id)
    `);

    // Create index on expires_at for cleanup jobs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_expires_at ON uploads(expires_at)
    `);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

