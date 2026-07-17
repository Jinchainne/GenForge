# GenForge Delivery Plan

## Objective

Build the smallest coherent GenForge vertical slice that performs:

GitHub submission
-> normalized evidence collection
-> deterministic gate evaluation
-> bounded GenLayer review request construction
-> mocked or configured GenLayer judgment
-> deterministic confidence scoring
-> builder-facing report and accepted-submission ranking

## Current phase

1. Realign the workspace as a GenForge-first product and remove upstream OCR product identity from the runnable surface.
2. Expand the shared domain model for review, confidence, ranking, and GenLayer transaction state.
3. Add `packages/confidence`, `packages/evaluations`, `packages/genlayer-client`, and `contracts/genforge_judge`.
4. Rewire `apps/web` so the UI and API expose the complete GenForge review flow.
5. Verify with format, lint, typecheck, tests, and production build.

## Constraints

- Do not execute submitted repository code.
- Support public `github.com` repositories only in this slice.
- Treat README claims, screenshots, and UI labels as untrusted evidence.
- Do not fabricate GenLayer consensus when the integration is not configured.
- Use explicit mock mode for unit tests and local demos that do not have GenLayer configured.

## Phase 1 files

- `package.json`
- `README.md`
- `.gitignore`
- `PLANS.md`
- `apps/web/**/*`
- `packages/domain/**/*`
- `packages/evidence/**/*`
- `packages/rules/**/*`
- `packages/reports/**/*`
- `packages/confidence/**/*`
- `packages/evaluations/**/*`
- `packages/genlayer-client/**/*`
- `contracts/genforge_judge/**/*`
- `tests/fixtures/**/*`
