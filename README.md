# GenForge

GenForge is a GenLayer-native builder submission review console for:

- public GitHub project review against builder milestone criteria
- bounded evidence packets for validator consensus
- appeal or dispute dossiers when a review needs escalation
- wallet-signed reward token records for accepted builder tracks

It performs a bounded review pipeline:

1. Read-only GitHub intake without executing submitted code
2. Deterministic readiness and rejection-gate checks
3. Evidence, confidence, scoring, and remediation generation
4. Bounded GenLayer request construction
5. Wallet-signed submission to live GenLayer Intelligent Contracts
6. Receipt tracking, appeal packet preparation, and reward token recording

## Workspace

- Web app: `apps/web`
- Shared schemas: `packages/domain`
- Evidence engine: `packages/evidence`
- Deterministic rules: `packages/rules`
- GitHub intake: `packages/github-adapter`
- Confidence engine: `packages/confidence`
- Evaluation helpers: `packages/evaluations`
- GenLayer client boundary: `packages/genlayer-client`
- Report generation: `packages/reports`
- Intelligent Contracts: `contracts/genforge_judge`
- Fixtures: `tests/fixtures`

## Run

```bash
npm install
npm --prefix apps/web run dev
```

The app is served from `apps/web` and remains compatible with Vercel root-directory deployment.

## Environment

Required for GitHub intake:

- `GITHUB_TOKEN` is optional but recommended for higher rate limits.

Optional for live GenLayer submission:

- `GENLAYER_MODE=sdk`
- `GENLAYER_NETWORK`
- `GENLAYER_CONTRACT_ADDRESS`
- `GENLAYER_RPC_URL`
- `GENLAYER_PRIVATE_KEY`

Optional for browser-wallet enterprise dispute submission:

- `NEXT_PUBLIC_GENLAYER_NETWORK`
- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD`
- `NEXT_PUBLIC_GENLAYER_STUDIO_URL`

Optional for secure operator-side live deploy commands:

- `GENFORGE_ENABLE_OPERATOR_DEPLOY=true`

Optional for explicit mock mode in local demos and tests:

- `GENLAYER_MODE=mock`

GenForge does not fabricate live GenLayer consensus when the integration is unavailable. If live configuration is missing, the UI reports `integration_unavailable` with explicit reasons.

## Vercel

Use `apps/web` as the Vercel Root Directory.

Observed Vercel guidance verified on July 17, 2026:

- Root Directory isolates the project to that subtree by default.
- For shared monorepo packages outside `apps/web`, enable `Include source files outside of the Root Directory`.

Recommended Vercel environment variables:

- `GITHUB_TOKEN`
- `GENLAYER_MODE`
- `GENLAYER_NETWORK`
- `GENLAYER_CONTRACT_ADDRESS`
- `GENLAYER_RPC_URL`
- `GENLAYER_PRIVATE_KEY`
- `NEXT_PUBLIC_GENLAYER_NETWORK`
- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD`
- `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD`
- `NEXT_PUBLIC_GENLAYER_STUDIO_URL`

The repository includes [apps/web/vercel.json](/abs/path/C:/Users/Asus/Desktop/genforge-submission/apps/web/vercel.json:1) to pin API max duration for the review and dispute routes.

Observed production constraint on July 17, 2026:

- OBSERVED: the hosted `/api/ops/genlayer` endpoint on Vercel reports `spawn genlayer ENOENT`, so Vercel is currently an inspect-only surface for contract ops.
- INFERRED: live `genlayer deploy` commands should run from a secure operator machine or CI runner where the GenLayer CLI is installed and funded, then the resulting contract addresses should be written back into Vercel public env vars.

## Go-live sequence

1. Fund the active operator account with GEN.
2. Run `genlayer network studionet` or the intended target network.
3. Deploy `contracts/genforge_judge/review_submission.py`.
4. Deploy `contracts/genforge_judge/resolve_enterprise_dispute.py`.
5. Deploy `contracts/genforge_judge/deploy_project_token.py` for Token Launch.
6. Copy the real contract addresses into Vercel as `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`, `NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS`, and `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS`.
7. Configure `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD` for the factory write method, and optionally `NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD` for receipt readback.
8. Redeploy `apps/web`, then verify wallet submission and receipt tracking from the browser UI.

## Contract tests

Python-side contract files now follow the official GenLayer boilerplate layout:

- direct tests: `tests/direct`
- integration tests: `tests/integration`
- Studio config: `gltest.config.yaml`

Available commands:

```bash
npm run lint:contract
npm run test:contract:direct
npm run test:contract:integration
```

## Verification

Commands used for this repository:

```bash
npm run lint:genforge
npm run typecheck:genforge
npm run test:genforge
npm run build:genforge
```

## Official references verified on July 17, 2026

- GenLayer tooling setup: `https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup`
- GenLayerJS docs: `https://docs.genlayer.com/api-references/genlayer-js`
- Equivalence Principle docs: `https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle`
- Official boilerplate repo: `https://github.com/genlayerlabs/genlayer-project-boilerplate`
- Official boilerplate `package.json`: pins `genlayer-js` at `^1.1.8`
- Official boilerplate `requirements.txt`:
  - `genlayer-py @ git+https://github.com/genlayerlabs/genlayer-py@v0.18`
  - `genlayer-test @ git+https://github.com/genlayerlabs/genlayer-testing-suite@v0.29`
  - `genvm-linter @ git+https://github.com/genlayerlabs/genvm-linter@main`

## Limitations

- Repository review remains limited to public GitHub repositories.
- Repository source is inspected read-only through bounded API calls.
- Live wallet writes still require deployed GenLayer contract addresses and funded accounts.
- Studio and Explorer verification are still manual unless a live GenLayer environment is configured.
- The included contract scaffolds have not been deployed from this workspace because the available local accounts were unfunded on July 17, 2026.
- OBSERVED: the local CLI is configured for `studionet`, but the active account showed `0 GEN` on July 17, 2026, which blocks real deployment from this workspace until it is funded.
- Contract direct/integration tests exist for both review and enterprise dispute flows, but live Studio-backed execution still depends on a local or hosted GenLayer environment plus Python dependencies from `contracts/genforge_judge/requirements.txt`.
