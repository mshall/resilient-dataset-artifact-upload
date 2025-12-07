#!/bin/bash

# Comprehensive API Test Script
# Tests all upload endpoints and functionality

BASE_URL="http://localhost:5000"
TEST_FILE="test-data.json"
TEST_FILE_SIZE=$(echo '{"test": "data", "value": 123}' | wc -c)

echo "🚀 Starting API Tests..."
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Health Check
echo "📋 Test 1: Health Check"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q "ok"; then
    print_result 0 "Health check endpoint"
else
    print_result 1 "Health check endpoint"
    echo "  Response: $BODY"
fi
echo ""

# Test 2: Initialize Upload
echo "📋 Test 2: Initialize Upload Session"
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/init" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"$TEST_FILE\",
    \"fileSize\": $TEST_FILE_SIZE,
    \"fileType\": \"application/json\",
    \"metadata\": {
      \"purpose\": \"testing\"
    }
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$INIT_RESPONSE" | tail -n1)
BODY=$(echo "$INIT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ] && echo "$BODY" | grep -q "uploadId"; then
    print_result 0 "Initialize upload session"
    UPLOAD_ID=$(echo "$BODY" | grep -o '"uploadId":"[^"]*' | cut -d'"' -f4)
    TOTAL_CHUNKS=$(echo "$BODY" | grep -o '"totalChunks":[0-9]*' | cut -d':' -f2)
    echo "  Upload ID: $UPLOAD_ID"
    echo "  Total Chunks: $TOTAL_CHUNKS"
else
    print_result 1 "Initialize upload session"
    echo "  Response: $BODY"
    echo "  HTTP Code: $HTTP_CODE"
    exit 1
fi
echo ""

# Test 3: Get Upload Status
echo "📋 Test 3: Get Upload Status"
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/upload/status/$UPLOAD_ID")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q "uploadId"; then
    print_result 0 "Get upload status"
    MISSING_CHUNKS=$(echo "$BODY" | grep -o '"missingChunks":\[[^\]]*\]' | cut -d'[' -f2 | cut -d']' -f1)
    echo "  Missing Chunks: $MISSING_CHUNKS"
else
    print_result 1 "Get upload status"
    echo "  Response: $BODY"
fi
echo ""

# Test 4: Upload Chunk
echo "📋 Test 4: Upload Chunk"
CHUNK_DATA=$(echo '{"test": "data", "value": 123}' | base64)
CHUNK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/chunk" \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"$UPLOAD_ID\",
    \"chunkIndex\": 0,
    \"totalChunks\": $TOTAL_CHUNKS,
    \"data\": \"$CHUNK_DATA\"
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$CHUNK_RESPONSE" | tail -n1)
BODY=$(echo "$CHUNK_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q "status"; then
    print_result 0 "Upload chunk"
    STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    echo "  Chunk Status: $STATUS"
else
    print_result 1 "Upload chunk"
    echo "  Response: $BODY"
fi
echo ""

# Test 5: Idempotency - Upload Same Chunk Again
echo "📋 Test 5: Idempotency Test (Upload Same Chunk)"
IDEMPOTENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/chunk" \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"$UPLOAD_ID\",
    \"chunkIndex\": 0,
    \"totalChunks\": $TOTAL_CHUNKS,
    \"data\": \"$CHUNK_DATA\"
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$IDEMPOTENT_RESPONSE" | tail -n1)
BODY=$(echo "$IDEMPOTENT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q "already_uploaded"; then
    print_result 0 "Idempotency test (chunk already uploaded)"
else
    print_result 1 "Idempotency test"
    echo "  Response: $BODY"
fi
echo ""

# Test 6: Get Status After Chunk Upload
echo "📋 Test 6: Get Status After Chunk Upload"
STATUS_RESPONSE2=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/upload/status/$UPLOAD_ID")
HTTP_CODE=$(echo "$STATUS_RESPONSE2" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE2" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    UPLOADED_CHUNKS=$(echo "$BODY" | grep -o '"uploadedChunks":[0-9]*' | cut -d':' -f2)
    if [ "$UPLOADED_CHUNKS" -ge 1 ]; then
        print_result 0 "Status shows uploaded chunks: $UPLOADED_CHUNKS"
    else
        print_result 1 "Status should show uploaded chunks"
    fi
else
    print_result 1 "Get status after chunk upload"
fi
echo ""

# Test 7: Complete Upload
echo "📋 Test 7: Complete Upload"
COMPLETE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/complete" \
  -H "Content-Type: application/json" \
  -d "{
    \"uploadId\": \"$UPLOAD_ID\"
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$COMPLETE_RESPONSE" | tail -n1)
BODY=$(echo "$COMPLETE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q "completed"; then
    print_result 0 "Complete upload"
    AI_STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "  Upload Status: $AI_STATUS"
else
    print_result 1 "Complete upload"
    echo "  Response: $BODY"
    echo "  HTTP Code: $HTTP_CODE"
fi
echo ""

# Test 8: Validation - Invalid File Size
echo "📋 Test 8: Validation Test (Invalid File Size)"
VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/init" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"huge-file.json\",
    \"fileSize\": 20000000000,
    \"fileType\": \"application/json\"
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$VALIDATION_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 400 ]; then
    print_result 0 "Validation rejects oversized file"
else
    print_result 1 "Validation should reject oversized file (got $HTTP_CODE)"
fi
echo ""

# Test 9: Validation - Invalid File Type
echo "📋 Test 9: Validation Test (Invalid File Type)"
INVALID_TYPE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/init" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"test.exe\",
    \"fileSize\": 1000,
    \"fileType\": \"application/x-executable\"
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$INVALID_TYPE_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 400 ]; then
    print_result 0 "Validation rejects invalid file type"
else
    print_result 1 "Validation should reject invalid file type (got $HTTP_CODE)"
fi
echo ""

# Test 10: Non-existent Upload Status
echo "📋 Test 10: Non-existent Upload Status"
NOT_FOUND_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/upload/status/non-existent-id")
HTTP_CODE=$(echo "$NOT_FOUND_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 404 ]; then
    print_result 0 "Returns 404 for non-existent upload"
else
    print_result 1 "Should return 404 for non-existent upload (got $HTTP_CODE)"
fi
echo ""

# Summary
echo "========================"
echo "📊 Test Summary"
echo "========================"
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi

