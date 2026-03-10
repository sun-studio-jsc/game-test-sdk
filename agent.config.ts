import { defineConfig } from './sdk/setup/config'
/**
 * Agent test configuration.
 *
 * mode "launch"  — Playwright spawns a fresh Chromium automatically.
 * mode "connect" — attaches to an already-running Chrome via CDP.
 *                  Start Chrome first:
 *                    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *                      --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug \
 *                      --no-first-run --no-default-browser-check 2>/dev/null &
 */
export default defineConfig({
    gameUrl: 'http://localhost:8080',
    mode: 'launch',
    cdpUrl: 'http://localhost:9222',
    gameServer: 'http://localhost:3100',
    commandTimeout: 10000,
    pollInterval: 100,
})
