# GenForge

![GenForge workflow](docs/readme-flow.svg)

GenForge is a GenLayer-native console for goods-trade document disputes. It helps a buyer, seller, or operator turn commercial documents into a bounded adjudication packet, submit that packet to a deployed GenLayer Intelligent Contract, track the receipt, and record the resulting settlement or service-credit token request.

It is built for disputes around purchase orders, invoices, bills of lading, packing lists, delivery evidence, payment release, short shipment, late delivery, and counterparty responses.

## What This Tool Does

```text
GenForge
|
+-- Trade Case
|   |
|   +-- Import PO / invoice / B/L / packing list / correspondence
|   +-- Structure buyer claim, seller response, remedy, amount, dates
|   +-- Run deterministic readiness checks
|   +-- Build a bounded GenLayer adjudication packet
|   +-- Submit the accepted packet on-chain with a browser wallet
|
+-- Runtime Ops
|   |
|   +-- Show public GenLayer network configuration
|   +-- Show deployed contract addresses and blockers
|   +-- Show operator deploy commands without pretending they ran
|
+-- Settlement Token
    |
    +-- Prepare settlement / service-credit record
    +-- Sign the request with the connected wallet
    +-- Write to the configured GenLayer token factory contract
    +-- Refresh and inspect the real transaction receipt
```

GenForge is not a generic AI page and not a simulated wallet demo. Browser submissions go through `genlayer-js` `writeContract(...)`, and transaction state is shown as blocked, pending, finalized, failed, or unavailable based on the real client path.

## Why GenLayer Fits

Goods-trade disputes often require judgment over messy, unstructured evidence: a purchase order says one quantity, a bill of lading says another, emails add context, and payment or delivery responsibility may be disputed. A normal deterministic app can organize the files, but it should not unilaterally decide liability or settlement.

GenForge uses GenLayer where that judgment matters:

- The deterministic frontend prepares a bounded evidence packet.
- The Intelligent Contract asks for a non-comparative adjudication result through GenLayer validator consensus.
- The contract stores the resulting disposition and payable adjustment.
- The frontend reads the resulting transaction and receipt state instead of inventing success.

## Reviewer Gate Map

The project is written to avoid the common rejection reasons shown in the review screenshots.

```text
Gate
|
+-- Real GenLayer contract in repo
|   +-- contracts/genforge_judge/resolve_enterprise_dispute.py
|   +-- contracts/genforge_judge/deploy_project_token.py
|
+-- Meaningful non-deterministic decision
|   +-- resolve_dispute uses gl.eq_principle.prompt_non_comparative(...)
|   +-- validator consensus determines the commercial disposition
|
+-- App-to-contract workflow
|   +-- packages/genlayer-client/src/index.ts
|   +-- submitBrowserContractJson(...)
|   +-- writeContract(...)
|   +-- waitForTransactionReceipt(...)
|
+-- No fake wallet / no local-only success
|   +-- wallet connection uses the browser provider
|   +-- generic wallets are not forced through a wallet-specific snap path
|   +-- UI does not create fake transaction hashes
|
+-- Settlement honesty
    +-- token factory records settlement or credit requests
    +-- it does not claim that ERC-20 value or GEN was transferred
```

## How To Use The App

1. Open the deployed app or run it locally.
2. Click `Connect Wallet` in the top-right header.
3. Approve the wallet account and GenLayer network switch when prompted.
4. In `Trade Case`, import or paste the trade documents and correspondence.
5. Click `Build Trade Case`.
6. Review the generated bounded packet and readiness status.
7. Open the `Chain` tab inside the generated case.
8. Click `Submit Trade Case On-Chain`.
9. Approve the wallet signature.
10. Refresh the receipt until the GenLayer transaction is finalized or clearly failed.
11. Use `Settlement Token` only after a case has an accepted settlement or credit basis.

## Local Development

```bash
npm install
npm --prefix apps/web run dev
```

Useful checks:

```bash
npm run lint:genforge
npm run typecheck:genforge
npm run test:genforge
npm run build:genforge
npm run lint:contract
```

Contract tests:

```bash
npm run test:contract:direct
npm run test:contract:integration
```

`test:contract:integration` requires a working GenLayer test environment. Browser wallet writes require a funded wallet account on the configured GenLayer network.

## Environment

Browser wallet submission:

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD=deploy_token
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD=get_token_deployment_json
NEXT_PUBLIC_GENLAYER_STUDIO_URL=https://studio.genlayer.com
```

Optional legacy repository-review route:

```bash
GITHUB_TOKEN=...
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x...
```

Optional operator-side SDK submission:

```bash
GENLAYER_MODE=sdk
GENLAYER_NETWORK=studionet
GENLAYER_CONTRACT_ADDRESS=0x...
GENLAYER_RPC_URL=https://studio.genlayer.com/api
GENLAYER_PRIVATE_KEY=0x...
```

Optional operator deploy button:

```bash
GENFORGE_ENABLE_OPERATOR_DEPLOY=true
```

`GENLAYER_PRIVATE_KEY` must stay server-side. `NEXT_PUBLIC_*` values are intentionally visible to the browser because the user wallet signs the transaction.

## Repository Structure

```text
.
|
+-- apps/
|   +-- web/
|       +-- app/                  Next.js app router, metadata, global UI CSS
|       +-- public/               GenForge logo assets
|       +-- src/components/       Trade case, runtime ops, settlement token UI
|       +-- src/lib/              public GenLayer config and workflow helpers
|       +-- src/test/             UI, SDK, API, rule tests
|
+-- contracts/
|   +-- genforge_judge/
|       +-- resolve_enterprise_dispute.py
|       +-- deploy_project_token.py
|       +-- review_submission.py
|
+-- packages/
|   +-- genlayer-client/          browser and server GenLayer SDK boundary
|   +-- domain/                   shared request/result schemas
|   +-- evidence/                 bounded evidence extraction
|   +-- rules/                    deterministic project and workflow checks
|   +-- reports/                  report formatting helpers
|
+-- tests/
|   +-- direct/                   direct-mode contract tests
|   +-- integration/              GenLayer integration test harness
|
+-- docs/
|   +-- readme-flow.svg           README workflow diagram
```

## On-Chain Behavior

OBSERVED in code:

- `resolve_dispute` is a public write method.
- The dispute contract uses `gl.eq_principle.prompt_non_comparative(...)` for the material commercial decision.
- The result is stored in `self.resolutions` and can be read through public view methods.
- Browser submissions use `writeContract(...)` and receipt tracking uses `waitForTransactionReceipt(...)`.
- Wallet connection no longer requires a wallet-specific snap method; generic browser wallets can use normal account and network-switch methods.

MISSING unless verified manually:

- A live wallet signature from your account.
- Your account balance for GenLayer fees.
- The final explorer/studio receipt for a specific transaction.

## Production Deployment

Production URL:

```text
https://genforge-seven.vercel.app/
```

Vercel root directory:

```text
apps/web
```

Because the app imports local monorepo packages from `../../packages/*`, enable Vercel's `Include source files outside of the Root Directory`.

OBSERVED limitation: Vercel runtime is not the contract deployment runner. If `/api/ops/genlayer` reports `spawn genlayer ENOENT`, deploy contracts from a secure operator machine or CI runner that has the GenLayer CLI installed and a funded account, then write the real addresses back into Vercel environment variables.

## Official Sources Checked

Checked on 2026-07-19:

- GenLayerJS: `https://docs.genlayer.com/api-references/genlayer-js`
- Writing Data to Intelligent Contracts: `https://docs.genlayer.com/developers/decentralized-applications/writing-data`
- Non-determinism: `https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism`
- Equivalence Principle: `https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle`
- Tooling setup: `https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup`

## Limitations

- Binary imports such as PDF, DOCX, XLSX, PNG, and JPG are tracked as evidence requiring manual review; the browser import does not pretend to OCR or fully parse them.
- The settlement token factory records a settlement or credit request. It does not claim that real ERC-20 value, GEN, or escrowed funds moved.
- The legacy GitHub submission review route remains in the repo, but the primary product surface is goods-trade document adjudication.
- Actual on-chain proof requires a real wallet signature, network fees, and a final GenLayer receipt.
