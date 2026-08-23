import { defineConfig } from 'vitest/config'

/**
 * Unit scope only: the WebSocket frame codec and the bridge server against a
 * fake extension. `tests/integration/` holds real-composition specs that boot
 * the whole harness Loader stack; run those from a dsh checkout, not here.
 */
export default defineConfig({
  test: {
    include: ['tests/*.spec.ts'],
  },
})
