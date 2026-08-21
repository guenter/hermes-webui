# Contributing

Thanks for your interest in improving Hermes Web UI.

## Getting started

```sh
npm install
npm run dev
```

The app runs in preview mode with fixture data if no Hermes dashboard is reachable at `http://127.0.0.1:9119`, so you can develop most UI work without a backend. See [README.md](README.md) for details on the project layout and how the app talks to Hermes.

## Before opening a PR

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

All four should pass. If you're changing UI behavior, also do a quick manual pass in the browser — see the "Verification" checklist in the README for the areas worth checking (responsive layouts, streaming/approval states, keyboard navigation, themes).

## Guidelines

- Keep changes focused; avoid unrelated refactors in the same PR.
- Match the existing code style — no linter-enforced formatting beyond ESLint, but keep new code consistent with surrounding code.
- Add or update tests alongside behavior changes. Component tests need the `// @vitest-environment jsdom` pragma (see the README's "Testing gotcha").
- Don't commit build output (`dist/`), `.tsbuildinfo` files, or anything under `.env*` — these are already gitignored.
- If your change touches `src/hermes-client.ts` or `src/message-normalizer.ts`, double-check behavior against both preview-mode data (`src/data.ts`) and, if you have access to one, a real Hermes backend — the two can drift in shape.

## Reporting issues

Please include reproduction steps, what you expected, and what happened instead. For UI issues, a screenshot or screen recording helps a lot.
