#!/usr/bin/env node

/**
 * Comprehensive API Test Script (Node.js version)
 * Tests all upload endpoints and functionality
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';
const TEST_DATA = { test: 'data', value: 123 };
const TEST_DATA_JSON = JSON.stringify(TEST_DATA);
const TEST_FILE_SIZE = Buffer.byteLength(TEST_DATA_JSON, 'utf8');

let uploadId = null;
let totalChunks = 0;
let testsPassed = 0;
let testsFailed = 0;

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, body: parsed, rawBody: body });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: null, rawBody: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Helper function to print test result
function printResult(passed, message) {
  if (passed) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    testsFailed++;
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n📋 Test 1: Health Check');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET',
    });

    const passed = result.statusCode === 200 && result.body.status === 'ok';
    printResult(passed, 'Health check endpoint');
    if (!passed) {
      console.log(`  Status: ${result.statusCode}, Body: ${result.rawBody}`);
    }
    return passed;
  } catch (error) {
    printResult(false, `Health check endpoint - Error: ${error.message}`);
    return false;
  }
}

async function testInitializeUpload() {
  console.log('\n📋 Test 2: Initialize Upload Session');
  try {
    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/init',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        fileName: 'test-data.json',
        fileSize: TEST_FILE_SIZE,
        fileType: 'application/json',
        metadata: {
          purpose: 'testing',
        },
      }
    );

    const passed =
      result.statusCode === 201 &&
      result.body.uploadId &&
      result.body.totalChunks > 0;

    if (passed) {
      uploadId = result.body.uploadId;
      totalChunks = result.body.totalChunks;
      console.log(`  Upload ID: ${uploadId}`);
      console.log(`  Total Chunks: ${totalChunks}`);
    }

    printResult(passed, 'Initialize upload session');
    if (!passed) {
      console.log(`  Status: ${result.statusCode}, Body: ${result.rawBody}`);
    }
    return passed;
  } catch (error) {
    printResult(false, `Initialize upload - Error: ${error.message}`);
    return false;
  }
}

async function testGetStatus() {
  console.log('\n📋 Test 3: Get Upload Status');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/upload/status/${uploadId}`,
      method: 'GET',
    });

    const passed =
      result.statusCode === 200 &&
      result.body.uploadId === uploadId &&
      Array.isArray(result.body.missingChunks);

    if (passed) {
      console.log(`  Missing Chunks: ${result.body.missingChunks.join(', ')}`);
      console.log(`  Uploaded Chunks: ${result.body.uploadedChunks}`);
    }

    printResult(passed, 'Get upload status');
    return passed;
  } catch (error) {
    printResult(false, `Get status - Error: ${error.message}`);
    return false;
  }
}

async function testUploadChunk() {
  console.log('\n📋 Test 4: Upload Chunk');
  try {
    const chunkData = Buffer.from(TEST_DATA_JSON).toString('base64');

    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/chunk',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        uploadId: uploadId,
        chunkIndex: 0,
        totalChunks: totalChunks,
        data: chunkData,
      }
    );

    const passed =
      result.statusCode === 200 &&
      (result.body.status === 'uploaded' ||
        result.body.status === 'already_uploaded');

    if (passed) {
      console.log(`  Chunk Status: ${result.body.status}`);
      if (result.body.progress) {
        console.log(
          `  Progress: ${result.body.progress.uploaded}/${result.body.progress.total}`
        );
      }
    }

    printResult(passed, 'Upload chunk');
    if (!passed) {
      console.log(`  Status: ${result.statusCode}, Body: ${result.rawBody}`);
    }
    return passed;
  } catch (error) {
    printResult(false, `Upload chunk - Error: ${error.message}`);
    return false;
  }
}

async function testIdempotency() {
  console.log('\n📋 Test 5: Idempotency Test (Upload Same Chunk)');
  try {
    const chunkData = Buffer.from(TEST_DATA_JSON).toString('base64');

    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/chunk',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        uploadId: uploadId,
        chunkIndex: 0,
        totalChunks: totalChunks,
        data: chunkData,
      }
    );

    const passed =
      result.statusCode === 200 &&
      result.body.status === 'already_uploaded';

    printResult(passed, 'Idempotency test (chunk already uploaded)');
    if (!passed) {
      console.log(`  Expected: already_uploaded, Got: ${result.body.status}`);
    }
    return passed;
  } catch (error) {
    printResult(false, `Idempotency test - Error: ${error.message}`);
    return false;
  }
}

async function testCompleteUpload() {
  console.log('\n📋 Test 6: Complete Upload');
  try {
    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/complete',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        uploadId: uploadId,
      }
    );

    const passed =
      result.statusCode === 200 &&
      result.body.status === 'completed' &&
      result.body.filePath;

    if (passed) {
      console.log(`  Upload Status: ${result.body.status}`);
      console.log(`  File Path: ${result.body.filePath}`);
      if (result.body.aiPipeline) {
        console.log(`  AI Pipeline: ${result.body.aiPipeline.status}`);
      }
    }

    printResult(passed, 'Complete upload');
    if (!passed) {
      console.log(`  Status: ${result.statusCode}, Body: ${result.rawBody}`);
    }
    return passed;
  } catch (error) {
    printResult(false, `Complete upload - Error: ${error.message}`);
    return false;
  }
}

async function testValidation() {
  console.log('\n📋 Test 7: Validation Tests');

  // Test oversized file
  try {
    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/init',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        fileName: 'huge-file.json',
        fileSize: 20000000000, // 20GB
        fileType: 'application/json',
      }
    );

    printResult(result.statusCode === 400, 'Validation rejects oversized file');
  } catch (error) {
    printResult(false, `Validation test - Error: ${error.message}`);
  }

  // Test invalid file type
  try {
    const result = await makeRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/upload/init',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        fileName: 'test.exe',
        fileSize: 1000,
        fileType: 'application/x-executable',
      }
    );

    printResult(result.statusCode === 400, 'Validation rejects invalid file type');
  } catch (error) {
    printResult(false, `Validation test - Error: ${error.message}`);
  }
}

async function testNotFound() {
  console.log('\n📋 Test 8: Non-existent Upload Status');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/upload/status/non-existent-id',
      method: 'GET',
    });

    printResult(result.statusCode === 404, 'Returns 404 for non-existent upload');
    return result.statusCode === 404;
  } catch (error) {
    printResult(false, `Not found test - Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting API Tests...');
  console.log('========================');

  await testHealthCheck();
  
  if (!(await testInitializeUpload())) {
    console.log('\n⚠️  Cannot continue tests without upload ID');
    printSummary();
    process.exit(1);
  }

  await testGetStatus();
  await testUploadChunk();
  await testIdempotency();
  await testCompleteUpload();
  await testValidation();
  await testNotFound();

  printSummary();
}

function printSummary() {
  console.log('\n========================');
  console.log('📊 Test Summary');
  console.log('========================');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log('');

  if (testsFailed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET',
    });
    return result.statusCode === 200;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Server is not running on http://localhost:5000');
    console.error('   Please start the server first: npm run dev');
    process.exit(1);
  }

  await runTests();
})();

