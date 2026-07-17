# GenForge

GenForge is a GenLayer-native project evaluation platform for public GitHub submissions.

It performs a bounded review pipeline:

1. Normalize a public `github.com` repository URL.
2. Collect source evidence through the GitHub API without executing untrusted code.
3. Apply deterministic gate rules.
4. Build a bounded GenLayer review request.
5. Submit the request to a live GenLayer contract when runtime secrets are configured, or surface an explicit integration-unavailable state.
6. Produce builder-facing findings, confidence factors, and accepted-submission ranking output.

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
- Intelligent Contract: `contracts/genforge_judge`
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

The repository includes [apps/web/vercel.json](/abs/path/C:/Users/Asus/Desktop/genforge-submission/apps/web/vercel.json:1) to pin API max duration for the review route.

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

- Public GitHub repositories only.
- Repository source is inspected read-only through bounded API calls.
- Studio and Explorer verification are still manual unless a live GenLayer environment is configured.
- The included contract scaffold has not been deployed from this workspace.
- Contract direct/integration tests were added, but live Studio-backed execution still depends on a local or hosted GenLayer environment plus Python dependencies from `contracts/genforge_judge/requirements.txt`.
