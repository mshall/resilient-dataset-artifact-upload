# API Testing Guide

## Port Configuration

The backend now runs on **port 5000** (changed from 3000).

Make sure to update your frontend configuration:
- Set `REACT_APP_API_URL=http://localhost:5000/api` in `.env`

## Running Tests

### Automated API Tests

We provide automated test scripts to verify all API functionality:

#### Node.js Test Script (Recommended)

```bash
# Make sure the server is running first
npm run dev

# In another terminal, run tests
npm run test:api
# or directly
node scripts/test-api.js
```

#### Bash Test Script

```bash
# Make sure the server is running first
npm run dev

# In another terminal, run tests
./scripts/test-api.sh
```

### Manual Testing with cURL

#### 1. Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

#### 2. Initialize Upload

```bash
curl -X POST http://localhost:5000/api/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-data.json",
    "fileSize": 1024,
    "fileType": "application/json",
    "metadata": {
      "purpose": "testing"
    }
  }'
```

Expected response:
```json
{
  "uploadId": "upl_abc123...",
  "chunkSize": 1048576,
  "totalChunks": 1,
  "uploadUrl": "/api/upload/chunk",
  "expiresAt": "2025-01-02T00:00:00.000Z"
}
```

Save the `uploadId` for subsequent requests.

#### 3. Get Upload Status

```bash
curl http://localhost:5000/api/upload/status/UPLOAD_ID
```

Replace `UPLOAD_ID` with the actual upload ID from step 2.

Expected response:
```json
{
  "uploadId": "upl_abc123...",
  "fileName": "test-data.json",
  "fileSize": 1024,
  "totalChunks": 1,
  "uploadedChunks": 0,
  "missingChunks": [0],
  "status": "INIT",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "expiresAt": "2025-01-02T00:00:00.000Z"
}
```

#### 4. Upload Chunk

```bash
# First, encode your data as base64
CHUNK_DATA=$(echo '{"test": "data"}' | base64)

curl -X POST http://localhost:5000/api/upload/chunk \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"UPLOAD_ID\",
    \"chunkIndex\": 0,
    \"totalChunks\": 1,
    \"data\": \"$CHUNK_DATA\"
  }"
```

Expected response:
```json
{
  "chunkIndex": 0,
  "status": "uploaded",
  "progress": {
    "uploaded": 1,
    "total": 1,
    "percentage": 100
  }
}
```

#### 5. Test Idempotency (Upload Same Chunk Again)

```bash
# Upload the same chunk again - should return "already_uploaded"
curl -X POST http://localhost:5000/api/upload/chunk \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"UPLOAD_ID\",
    \"chunkIndex\": 0,
    \"totalChunks\": 1,
    \"data\": \"$CHUNK_DATA\"
  }"
```

Expected response:
```json
{
  "chunkIndex": 0,
  "status": "already_uploaded",
  "message": "Chunk already uploaded successfully",
  "progress": {
    "uploaded": 1,
    "total": 1,
    "percentage": 100
  }
}
```

#### 6. Complete Upload

```bash
curl -X POST http://localhost:5000/api/upload/complete \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "UPLOAD_ID"
  }'
```

Expected response:
```json
{
  "uploadId": "upl_abc123...",
  "status": "completed",
  "filePath": "./uploads/final/upl_abc123.../test-data.json",
  "message": "Upload completed successfully, AI processing initiated",
  "aiPipeline": {
    "status": "initiated",
    "estimatedTime": "5-10 minutes",
    "jobId": "multi_1234567890"
  }
}
```

### Validation Tests

#### Test Invalid File Size

```bash
curl -X POST http://localhost:5000/api/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "huge-file.json",
    "fileSize": 20000000000,
    "fileType": "application/json"
  }'
```

Expected: HTTP 400 with error message about file size limit.

#### Test Invalid File Type

```bash
curl -X POST http://localhost:5000/api/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.exe",
    "fileSize": 1000,
    "fileType": "application/x-executable"
  }'
```

Expected: HTTP 400 with error message about invalid file type.

#### Test Non-existent Upload

```bash
curl http://localhost:5000/api/upload/status/non-existent-id
```

Expected: HTTP 404 with error message.

## Test Coverage

The automated test scripts verify:

✅ Health check endpoint  
✅ Upload session initialization  
✅ Upload status retrieval  
✅ Chunk upload (idempotent)  
✅ Idempotency (duplicate chunk upload)  
✅ Upload completion  
✅ Validation (file size, file type)  
✅ Error handling (404 for non-existent uploads)  

## Troubleshooting

### Server Not Running

If tests fail with connection errors:
```bash
# Start the server
npm run dev
```

### Port Already in Use

If port 5000 is already in use:
```bash
# Change PORT in .env
PORT=5001

# Or use a different port
PORT=5001 npm run dev
```

### Database/Redis Connection Issues

Ensure PostgreSQL and Redis are running:
```bash
# Check PostgreSQL
psql -h localhost -U user -d upload_db

# Check Redis
redis-cli ping
```

### Test Failures

If tests fail:
1. Check server logs for errors
2. Verify database and Redis connections
3. Check file permissions for upload directories
4. Ensure all services are running

## Integration with Frontend

After updating the port, test the full stack:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm start`
3. Upload a file through the UI
4. Verify all functionality works end-to-end

## Performance Testing

For performance testing with larger files:

```bash
# Create a test file
dd if=/dev/zero of=test-large.bin bs=1M count=100

# Use the upload API to test chunking with larger files
```

The system is designed to handle:
- Files up to 10 GB
- Chunks of 1 MB each
- Parallel uploads (5 concurrent chunks)
- Automatic retry with exponential backoff

