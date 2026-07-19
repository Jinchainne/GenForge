# GenForge Web MVP

This application is the GenForge web surface for public GitHub submission
evaluation. It combines deterministic evidence collection with live or
explicitly unavailable GenLayer consensus status.

## Stack

- Next.js App Router
- TypeScript with strict type checking
- server-side route handlers
- product-neutral local packages under `packages/*`

## Environment

Copy `.env.example` to `.env.local` and configure the values you need:

```bash
GITHUB_TOKEN=your_token_here
GENLAYER_MODE=sdk
GENLAYER_NETWORK=studionet
GENLAYER_CONTRACT_ADDRESS=0x...
GENLAYER_RPC_URL=https://...
GENLAYER_PRIVATE_KEY=0x...
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_RPC_URL=https://...
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_METHOD=deploy_token
NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_READBACK_METHOD=
```

`GENLAYER_PRIVATE_KEY` stays server-side only. `NEXT_PUBLIC_*` values are
intentionally exposed to the browser so MetaMask can connect to the selected
network and call the configured GenLayer contracts.

## Scripts

Run from `apps/web`:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Vercel

Set the Vercel Root Directory to:

```text
apps/web
```

Because this app imports local packages from `../../packages/*`, enable
Vercel's `Include source files outside of the Root Directory` setting.

The project includes [vercel.json](/abs/path/C:/Users/Asus/Desktop/genforge-submission/apps/web/vercel.json:1)
to set API function duration for the review route.

This app does not clone repositories, execute repository code, or install
repository dependencies. It uses GitHub API metadata, trees, and bounded file
content retrieval only.
