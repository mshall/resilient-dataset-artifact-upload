# Backend Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ (or Docker)
- Redis 6+ (or Docker)
- MinIO or AWS S3 (or Docker for MinIO)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- Database connection (PostgreSQL)
- Redis connection
- S3/MinIO credentials
- Upload settings

3. Create logs directory:
```bash
mkdir -p logs
```

## Database Setup

### Using Docker (Recommended for Development)

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=upload_db \
  -p 5432:5432 \
  postgres:15
```

### Manual Setup

```sql
CREATE DATABASE upload_db;
```

The application will automatically create the `uploads` table on startup.

## Redis Setup

### Using Docker

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Manual Setup

Install Redis from your package manager or download from https://redis.io

## Storage Setup (MinIO)

### Using Docker

```bash
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Access MinIO console at http://localhost:9001

## Running the Application

### Development Mode

```bash
npm run dev
```

Uses `ts-node-dev` for hot reloading.

### Production Build

```bash
npm run build
npm start
```

## Testing

### Unit Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

### Integration Tests

```bash
npm run test:integration
```

Note: Integration tests require running PostgreSQL, Redis, and MinIO.

## API Endpoints

### Health Check

```
GET /health
```

### Initialize Upload

```
POST /api/upload/init
Content-Type: application/json

{
  "fileName": "dataset.jsonl",
  "fileSize": 123456789,
  "fileType": "application/json",
  "checksum": "sha256:....",
  "metadata": {
    "purpose": "training"
  }
}
```

### Upload Chunk

```
POST /api/upload/chunk
Content-Type: application/json

{
  "uploadId": "upl_123abc",
  "chunkIndex": 0,
  "totalChunks": 118,
  "data": "<base64-encoded-bytes>"
}
```

### Get Upload Status

```
GET /api/upload/status/:uploadId
```

### Complete Upload

```
POST /api/upload/complete
Content-Type: application/json

{
  "uploadId": "upl_123abc"
}
```

## Configuration

Key configuration options in `.env`:

- `CHUNK_SIZE`: Default chunk size (1 MB)
- `MAX_FILE_SIZE`: Maximum file size (10 GB)
- `UPLOAD_EXPIRY_HOURS`: Upload session expiry (24 hours)
- `UPLOAD_TEMP_DIR`: Temporary chunk storage directory
- `UPLOAD_FINAL_DIR`: Final file storage directory

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check connection credentials in `.env`
- Ensure database exists

### Redis Connection Error
- Verify Redis is running
- Check Redis host/port in `.env`
- Test connection: `redis-cli ping`

### Storage Errors
- In development, the app falls back to local filesystem if S3/MinIO is unavailable
- Check S3/MinIO credentials and endpoint
- Verify bucket exists (created automatically if using MinIO)

### Port Already in Use
Change `PORT` in `.env` to use a different port.

## Docker Compose (Full Stack)

See repository root for `docker-compose.yml` that sets up:
- Backend API
- Frontend
- PostgreSQL
- Redis
- MinIO

```bash
docker-compose up --build
```

## Additional Resources

- [Express Documentation](https://expressjs.com)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Redis Documentation](https://redis.io/docs)
- [MinIO Documentation](https://min.io/docs)

