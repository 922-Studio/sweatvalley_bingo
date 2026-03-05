const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    reporters: process.env.CI
      ? ['verbose', ['allure-vitest/reporter', { resultsDir: process.env.ALLURE_RESULTS_DIR || 'reports/allure' }]]
      : ['verbose']
  }
});
