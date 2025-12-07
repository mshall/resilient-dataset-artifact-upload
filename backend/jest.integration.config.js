module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  testTimeout: 30000,
};

