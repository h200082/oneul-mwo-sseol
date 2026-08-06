import { defineConfig, devices } from '@playwright/test'

const FIREBASE_E2E_BASE_URL = 'http://127.0.0.1:4174'

export default defineConfig({
  testDir: './tests/e2e-firebase',
  outputDir: 'test-results/firebase-e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: 'line',
  use: {
    baseURL: FIREBASE_E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'firebase-mobile-pair',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4174 --strictPort',
    env: {
      VITE_MULTIPLAYER_BACKEND: 'firebase',
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN:
        'demo-oneul-mwo-sseol.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-oneul-mwo-sseol',
      VITE_FIREBASE_APP_ID: '1:1234567890:web:firebase-e2e',
      VITE_FIREBASE_USE_EMULATORS: 'true',
    },
    url: FIREBASE_E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
