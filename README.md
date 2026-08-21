# Hermes Web UI

A consumer-friendly, responsive browser interface for Hermes Agent profiles and conversations.

## Requirements

- Node.js 20+
- A running Hermes dashboard, if you want to talk to a real agent instead of preview data (see below).

## Run locally

```sh
npm install
npm run dev
```

Vite runs at `http://127.0.0.1:4173`.

- If a Hermes dashboard is reachable at `http://127.0.0.1:9119`, dev requests under `/api` are proxied to it (see the [known discrepancy](#known-discrepancy) below regarding `/ws`).
- Otherwise the app starts in a clearly labeled **preview mode** with representative profiles, conversation histories, tool calls, approvals, and background runs — no backend required. This is the easiest way to explore the UI or work on a component in isolation.

To point dev traffic at a Hermes instance running somewhere other than `127.0.0.1:9119`, edit the `server.proxy` entry in `vite.config.ts`.

## Architecture

Hermes Web UI runs as a standalone, top-level browser document. It does not render inside the Hermes dashboard shell. Production assets use relative URLs (`base: './'` in `vite.config.ts`), so the built bundle can be served from any static path.

The frontend and Hermes API are expected to share a browser origin. This preserves dashboard authentication (session cookies) and avoids a separate CORS configuration. The app talks to same-origin Hermes endpoints:

- Dashboard REST APIs for profiles, sessions, and paginated message history.
- `POST /api/auth/ws-ticket` for authenticated remote dashboards.
- Hermes TUI Gateway JSON-RPC over `/api/ws`.
- Profile-aware session methods and message, tool, approval, clarification, secret, and lifecycle events.

Hermes remains the canonical source of profile and conversation history. IndexedDB (via Dexie, see `src/storage.ts`) stores only display metadata, profile emoji, drafts, and UI preferences — nothing that can't be safely rebuilt from the server.

## Project layout

```
src/
  App.tsx                 top-level layout (rail, conversation list, composer)
  hermes-client.ts         talks to the Hermes REST/WebSocket API
  data.ts                  preview-mode fixture data
  message-normalizer.ts    normalizes raw Hermes events into UI message blocks
  store.ts                 zustand app state
  storage.ts               Dexie/IndexedDB persistence for UI-local data
  components/               UI components (Composer, Message, Rail, ...)
```

## Commands

- `npm run dev` — Vite dev server, see [Run locally](#run-locally).
- `npm run build` — type-checks (`tsc -b`) and builds the production bundle with Vite.
- `npm run typecheck` — type-checks only, without building.
- `npm test` — runs the test suite with Vitest.
- `npm run lint` — runs ESLint.
- `npm run deploy:agent` — builds and pushes the app to a Hermes dashboard as a plugin over SSH; see [Deploy as a Hermes dashboard plugin](#deploy-as-a-hermes-dashboard-plugin). Not needed to develop or use the app locally.

### Testing gotcha

Tests are colocated (`*.test.ts(x)` next to the source they cover). There is no global jsdom environment configured in `vite.config.ts`, so any test that needs the DOM (e.g. component tests using Testing Library) must start with the per-file pragma:

```ts
// @vitest-environment jsdom
```

See `src/components/Composer.test.tsx` for reference. Omitting the pragma runs the test in Node, where DOM APIs are unavailable.

### Known discrepancy

`/ws` is not proxied by `vite.config.ts` — only `/api` is. Keep this in mind if you're debugging WebSocket connectivity in local dev; the Hermes gateway connection actually runs over `/api/ws`.

## Deploy as a Hermes dashboard plugin

Hermes 0.20+ can serve this app from a dashboard plugin's static assets, launching it as a top-level page (so the dashboard's own navigation doesn't overlap the chat UI) while preserving dashboard auth cookies and `/api/ws` access.

`npm run deploy:agent` runs `scripts/deploy-plugin.sh`, which:

1. Builds the app locally (`npm ci && npm run build`).
2. Stages `deploy/plugin/{plugin.yaml,manifest.json,loader.js}` plus the built `dist/` into a temp directory.
3. `rsync`s that directory to a remote Hermes install over SSH.
4. Over the same SSH connection, disables any legacy `hermes-ui` plugin, enables `hermes-webui`, and restarts the `hermes-dashboard.service` systemd unit so the dashboard picks up the new plugin.

This script is written for a specific deployment shape and is optional — it's not required to build, test, or run the app. To use it against your own Hermes install:

- Add an SSH host alias (e.g. `agent`) to `~/.ssh/config` that resolves to your Hermes host.
- Ensure that host has `hermes` installed and a user-level systemd service named `hermes-dashboard.service`.
- Run `npm run deploy:agent` (or `bash scripts/deploy-plugin.sh <your-host-alias>` to use a different alias than `agent`).

`deploy/plugin/loader.js` is a small vanilla-JS stub (no build step) that the Hermes dashboard loads for its `/webui` tab; it immediately redirects to the standalone built app so the app runs as a top-level document rather than embedded in the dashboard shell.

If you're deploying by some other means (static hosting, a different CI pipeline, etc.), you only need the output of `npm run build` (the `dist/` directory) served from the same origin as your Hermes API.

## Verification

```sh
npm test
npm run build
```

Manual browser checks should cover:

- Desktop at 1440×900 and 1024×768.
- Mobile at 390×844 and 360×800, including safe-area behavior.
- Conversation switching while another profile continues streaming.
- Approval badges and response cards in inactive and active conversations.
- Profile avatar editing, persistence after refresh, command palette, light/dark themes, attachments, slash completion, and interrupt.
- Keyboard-only navigation, visible focus, reduced motion, and screen-reader labels.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
