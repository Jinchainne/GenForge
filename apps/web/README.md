# GenForge Web MVP

This application is the first standalone GenForge MVP. It provides a read-only
`Preliminary Repository Review` flow for public GitHub repositories.

## Stack

- Next.js App Router
- TypeScript with strict type checking
- server-side route handlers
- product-neutral local packages under `packages/*`

## Environment

Copy `.env.example` to `.env.local` when you want higher GitHub API limits:

```bash
GITHUB_TOKEN=your_token_here
```

The token is used on the server only and is never exposed to the client.

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

Because this app imports local packages from `../../packages/*`, enable Vercel's
`Include source files outside of the Root Directory` setting for the build.

This MVP does not clone repositories, execute repository code, or install
repository dependencies. It uses GitHub API metadata, trees, and file content
retrieval only.
