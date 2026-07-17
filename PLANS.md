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

Enterprise dispute intake
-> bilateral party capture
-> evidence readiness checks
-> bounded adjudication packet construction
-> wallet-ready GenLayer escalation
-> resubmission workflow preparation

## Current phase

1. Keep the deterministic GitHub intake and report pipeline as the read-only evidence stage.
2. Add browser-wallet GenLayer submission helpers that follow the official MetaMask plus `client.connect()` pattern.
3. Rewire `apps/web` into a workflow surface with dual workspaces:
   repository review and enterprise dispute adjudication.
4. Preserve the bounded-request contract flow and avoid claiming live success without a verified receipt.
5. Add deterministic dispute dossier generation, issue triage, and evidence-pack shaping before any on-chain escalation.
6. Verify with typecheck, tests, and production build after each UI and SDK slice.

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

## Latest evidence

- OBSERVED: `npm run lint:genforge` passed on July 17, 2026.
- OBSERVED: `npm run typecheck:genforge` passed on July 17, 2026.
- OBSERVED: `npm run test:genforge` passed with 32 tests on July 17, 2026.
- OBSERVED: `npm run build:genforge` passed on July 17, 2026.
- OBSERVED: enterprise dispute contract scaffolding and integration test files were added on July 17, 2026.
- OBSERVED: the enterprise dispute workspace was upgraded with commercial control-tower fields, counterparty packet planning, and audit-trail views on July 17, 2026.
- OBSERVED: the top-level workspace shell was redesigned on July 17, 2026 with a runtime registry, capability index, and design-system-inspired control surface while preserving real GenLayer status boundaries.
- OBSERVED: a `Contract Ops` workspace and `/api/ops/genlayer` operator route were added on July 17, 2026 to expose live CLI status, deployment blockers, and guarded deployment commands.
- OBSERVED: the contract-ops flow was refined on July 17, 2026 to separate operator deployment readiness from browser-wallet submission readiness, preventing public env gaps from being mislabeled as deploy blockers.
- MANUAL_REVIEW_REQUIRED: `npm run test:contract:direct` is currently blocked on this Windows host by a `gltest` temp-file `PermissionError` while replacing stdin, affecting both the existing review contract tests and the new dispute contract tests.
- MISSING: a funded GenLayer deployment account for live contract deployment.
- MISSING: production `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` in Vercel.
- MISSING: production `NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS` in Vercel.
