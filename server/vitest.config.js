const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    reporters: process.env.CI
      ? ['verbose', ['allure-vitest/reporter', { resultsDir: process.env.ALLURE_RESULTS_DIR || 'reports/allure' }]]
      : ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['gameLogic.js', 'server.js'],
      reporter: ['text', 'cobertura'],
      reportsDirectory: 'reports',
    },
  }
});
