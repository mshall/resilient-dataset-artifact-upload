# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Services with Docker

```bash
# PostgreSQL
docker run -d --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=upload_db -p 5432:5432 postgres:15

# Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# MinIO
docker run -d --name minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data --console-address ":9001"
```

### 3. Configure Environment

Create `.env` file:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/upload_db
REDIS_HOST=localhost
REDIS_PORT=6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=uploads
```

### 4. Create Logs Directory

```bash
mkdir -p logs
```

### 5. Start the Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### 6. Test the API

```bash
# Health check
curl http://localhost:5000/health

# Initialize upload
curl -X POST http://localhost:5000/api/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.json",
    "fileSize": 1048576,
    "fileType": "application/json"
  }'
```

## 📋 API Endpoints

- `GET /health` - Health check
- `POST /api/upload/init` - Initialize upload session
- `POST /api/upload/chunk` - Upload a chunk
- `GET /api/upload/status/:uploadId` - Get upload status
- `POST /api/upload/complete` - Complete upload

## 🧪 Run Tests

```bash
# Unit tests
npm test

# With coverage
npm test -- --coverage
```

## 📚 More Information

- See `SETUP.md` for detailed setup instructions
- See `README.md` for full documentation

---

Happy coding! 🎉

