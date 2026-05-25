import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15_000,
    // Foundation modules touch window/localStorage at module load time
    // (network.js, vault.js). happy-dom is small and fast and gives the
    // smoke tests the browser globals they need.
    environment: 'happy-dom',
  },
});
