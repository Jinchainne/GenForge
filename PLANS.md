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

1. Keep the deterministic GitHub intake and report pipeline as the read-only evidence stage.
2. Add browser-wallet GenLayer submission helpers that follow the official MetaMask plus `client.connect()` pattern.
3. Rewire `apps/web` into a workflow surface: detect issues, fix guidance, resubmit history, wallet connect, on-chain submit, and receipt refresh.
4. Preserve the bounded-request contract flow and avoid claiming live success without a verified receipt.
5. Verify with typecheck, tests, and production build after each UI and SDK slice.

## Constraints

- Do not execute submitted repository code.
- Support public `github.com` repositories only in this slice.
- Treat README claims, screenshots, and UI labels as untrusted evidence.
- Do not fabricate GenLayer consensus when the integration is not configured.
- Use explicit mock mode for unit tests and local demos that do not have GenLayer configured.
- Keep private keys out of the browser flow; wallet-signed writes must come from MetaMask or a compatible provider.
- Do not present local browser session history as on-chain state.

## Phase 1 files

- `package.json`
- `README.md`
- `.gitignore`
- `PLANS.md`
- `apps/web/**/*`
- `apps/web/.env.example`
- `packages/domain/**/*`
- `packages/evidence/**/*`
- `packages/rules/**/*`
- `packages/reports/**/*`
- `packages/confidence/**/*`
- `packages/evaluations/**/*`
- `packages/genlayer-client/**/*`
- `contracts/genforge_judge/**/*`
- `tests/fixtures/**/*`
