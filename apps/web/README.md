# GenForge Web

Next.js web surface for the GenForge trade document console.

```text
apps/web
|
+-- app/
|   +-- page.tsx          renders the workspace shell
|   +-- layout.tsx        metadata, fonts, logo icon
|   +-- globals.css       Hallmark-stamped workbench UI
|
+-- public/
|   +-- genforge-logo.svg brand mark used by UI and metadata
|
+-- src/components/
|   +-- workspace-shell.tsx
|   +-- enterprise-dispute-dashboard.tsx
|   +-- contract-ops-dashboard.tsx
|   +-- token-launch-dashboard.tsx
|
+-- src/lib/
|   +-- public-genlayer-config.ts
|   +-- dispute-domain.ts
|   +-- review-workflow.ts
|
+-- src/test/
    +-- ui.test.tsx
    +-- genlayer-client.test.ts
    +-- genlayer-ops-route.test.ts
```

## Purpose

The web app is for goods-trade dispute work:

- import or paste commercial document evidence
- structure buyer and seller positions
- build a bounded GenLayer adjudication packet
- connect a browser wallet
- submit the packet to configured GenLayer contracts
- track receipts and settlement records

It does not clone untrusted repositories, execute user projects, or invent transaction receipts.

## Why GenLayer

This belongs on GenLayer because the disputed result depends on adjudication over commercial evidence, not only deterministic form validation. The app prepares the evidence, then writes the bounded case to a GenLayer Intelligent Contract so validator consensus can resolve liability, payment adjustment, or request-more-info outcomes.

## Verification Workflow

```text
import documents
  -> build bounded trade packet
  -> connect wallet
  -> submit with writeContract
  -> wait for receipt
  -> read stored judgment or settlement record
```

## Run

```bash
npm install
npm run dev
```

## Check

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Environment

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD=deploy_token
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD=get_token_deployment_json
NEXT_PUBLIC_GENLAYER_STUDIO_URL=https://studio.genlayer.com
```

Set Vercel Root Directory to `apps/web` and enable `Include source files outside of the Root Directory`.
