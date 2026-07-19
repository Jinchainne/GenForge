# GenForge

GenForge is a GenLayer-native trade document adjudication console for:

- goods purchase and sale disputes
- purchase orders, invoices, bills of lading, packing lists, and trade correspondence
- bounded buyer/seller evidence packets for validator consensus
- wallet-signed settlement or credit token records after accepted cases

It performs a bounded trade-case pipeline:

1. Import or enter commercial document evidence
2. Structure buyer and seller positions
3. Run deterministic readiness checks for document depth and contract anchoring
4. Build a bounded GenLayer adjudication request
5. Submit the case to live GenLayer Intelligent Contracts with a browser wallet
6. Track receipts and prepare settlement or service-credit records

## Workspace

- Web app: `apps/web`
- Shared schemas: `packages/domain`
- Evidence engine: `packages/evidence`
- Deterministic rules: `packages/rules`
- Legacy GitHub intake: `packages/github-adapter`
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

Optional for legacy GitHub repository intake:

- `GITHUB_TOKEN` is optional but recommended for higher rate limits.

Optional for operator-side live GenLayer submission:

- `GENLAYER_MODE=sdk`
- `GENLAYER_NETWORK`
- `GENLAYER_CONTRACT_ADDRESS`
- `GENLAYER_RPC_URL`
- `GENLAYER_PRIVATE_KEY`

Optional for browser-wallet trade dispute submission:

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

The repository includes `apps/web/vercel.json` to pin API max duration for the review and dispute routes.

Observed production constraint on July 17, 2026:

- OBSERVED: the hosted `/api/ops/genlayer` endpoint on Vercel reports `spawn genlayer ENOENT`, so Vercel is currently an inspect-only surface for contract ops.
- INFERRED: live `genlayer deploy` commands should run from a secure operator machine or CI runner where the GenLayer CLI is installed and funded, then the resulting contract addresses should be written back into Vercel public env vars.

## Go-live sequence

1. Fund the active operator account with GEN.
2. Run `genlayer network studionet` or the intended target network.
3. Deploy `contracts/genforge_judge/resolve_enterprise_dispute.py` for trade adjudication.
4. Deploy `contracts/genforge_judge/deploy_project_token.py` for settlement or credit token records.
5. Deploy `contracts/genforge_judge/review_submission.py` only if enabling the legacy repository-review route.
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

- Imported binary documents such as PDF, DOCX, XLSX, and images are recorded as document evidence requiring manual content review; the browser import does not pretend to OCR or parse them.
- The legacy repository-review route remains limited to public GitHub repositories and is no longer the primary workspace.
- Live wallet writes still require deployed GenLayer contract addresses and funded accounts.
- Studio and Explorer verification are still manual unless a live GenLayer environment is configured.
- OBSERVED on July 19, 2026: the Studionet trade dispute, token factory, and legacy review contracts have been deployed and configured in production.
- Contract direct/integration tests exist for review, trade dispute, and token factory flows, but live Studio-backed execution still depends on a local or hosted GenLayer environment plus Python dependencies from `contracts/genforge_judge/requirements.txt`.
