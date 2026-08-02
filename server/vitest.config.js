import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The supertest + mongodb-memory-server integration test (test/task.api.test.js)
    // is slow and resource-heavy next to the mocked unit tests. Running test
    // files in parallel let it starve/interleave with the rest of the suite
    // and made an unrelated file (legacyKraController.test.js) flake under
    // load. Sequential file execution is slower overall but reliable.
    fileParallelism: false,
  },
});
