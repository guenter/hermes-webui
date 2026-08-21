# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`hermes-webui` is a standalone React + TypeScript browser UI for Hermes Agent profiles/conversations. It is built and deployed as a **top-level document**, not embedded in the Hermes dashboard shell — this is deliberate, so the frontend shares an origin with the Hermes API (auth/CORS). The `base: './'` setting in `vite.config.ts` keeps production asset URLs relative so the build can be served from any static path.

## Commands

- `npm run dev` — Vite dev server on `http://127.0.0.1:4173`. Proxies `/api` to `http://127.0.0.1:9119` (a locally running Hermes dashboard); without one running the app falls back to a preview mode with fake data.
- `npm run build` — `tsc -b && vite build`
- `npm run typecheck` — `tsc -b --pretty false`
- `npm test` — `vitest run`
- `npm run lint` — runs ESLint.
- `npm run deploy:agent` — builds and pushes the app to a remote Hermes dashboard plugin (see below).

## Testing gotcha

Tests are colocated (`*.test.ts(x)` next to source). There is no global jsdom environment configured in `vite.config.ts` — any test that needs the DOM (e.g. component tests with Testing Library) must start with the per-file pragma:

```ts
// @vitest-environment jsdom
```

See `src/components/Composer.test.tsx` for reference. Omitting the pragma makes the test run in Node and DOM APIs will fail.

## Known discrepancy

`vite.config.ts` proxies only `/api`, not `/ws` — the Hermes gateway connection actually runs over `/api/ws`. Be aware of this when debugging WebSocket connectivity issues in local dev.

## Deploy

`npm run deploy:agent` runs `scripts/deploy-plugin.sh`, which builds the app, stages `deploy/plugin/{plugin.yaml,manifest.json,loader.js}` + `dist/`, rsyncs to a remote box via an SSH host alias, then over SSH disables a legacy `hermes-ui` plugin, enables `hermes-webui`, and restarts `hermes-dashboard.service`. The script takes the SSH host alias as its first argument (`bash scripts/deploy-plugin.sh <host>`), defaulting to `agent` if omitted — so `npm run deploy:agent` only works out of the box if you have an `agent` alias configured in `~/.ssh/config`; other users should either add that alias or invoke the script directly with their own host. Remote paths are resolved against the remote user's `$HOME`, and `hermes` is expected on the remote `PATH` — no hardcoded remote username.

`deploy/plugin/loader.js` is a small vanilla-JS stub (no build step) that Hermes dashboard loads for the `/webui` tab; it immediately redirects to the standalone built app so the app runs as a top-level document rather than embedded in the dashboard.
