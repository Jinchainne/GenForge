import type { RepositorySnapshot } from "@genforge/domain";

export const noGenLayerSnapshot: RepositorySnapshot = {
  metadata: {
    owner: "plain",
    repo: "webapp",
    defaultBranch: "main",
    commitSha: "1111111aaaaaaa",
    description: "Plain web app",
    visibility: "public",
    stars: 3,
    htmlUrl: "https://github.com/plain/webapp",
  },
  tree: [
    { path: "README.md", type: "blob", size: 1200 },
    { path: "package.json", type: "blob", size: 800 },
    { path: "package-lock.json", type: "blob", size: 5000 },
  ],
  files: [
    {
      path: "README.md",
      size: 1200,
      purpose: "readme",
      textExcerpt: "A generic React project.",
    },
    {
      path: "package.json",
      size: 800,
      purpose: "manifest",
      textExcerpt: '{"name":"plain-webapp","dependencies":{"react":"19.2.7"}}',
    },
    {
      path: "package-lock.json",
      size: 5000,
      purpose: "lockfile",
      textExcerpt: '{"lockfileVersion":3}',
    },
  ],
  fetchedAt: "2026-07-17T00:00:00.000Z",
  filesConsidered: 3,
  filesRetrieved: 3,
  rateLimitRemaining: 50,
  limitations: [],
};

export const likelyGenLayerSnapshot: RepositorySnapshot = {
  metadata: {
    owner: "builder",
    repo: "judge-dapp",
    defaultBranch: "main",
    commitSha: "abc1234def5678",
    description: "GenLayer-native judging app",
    visibility: "public",
    stars: 42,
    htmlUrl: "https://github.com/builder/judge-dapp",
  },
  tree: [
    { path: "README.md", type: "blob", size: 1800 },
    { path: "contracts/judge_contract.py", type: "blob", size: 3200 },
    { path: "web/src/contractClient.ts", type: "blob", size: 1200 },
    { path: "package.json", type: "blob", size: 900 },
    { path: "pnpm-lock.yaml", type: "blob", size: 6000 },
    { path: "vercel.json", type: "blob", size: 300 },
  ],
  files: [
    {
      path: "README.md",
      size: 1800,
      purpose: "readme",
      textExcerpt:
        "GenLayer repository for Intelligent Contract judging with frontend and deployment docs.",
    },
    {
      path: "contracts/judge_contract.py",
      size: 3200,
      purpose: "contract_candidate",
      textExcerpt:
        "from genlayer import *\nclass Judge(gl.Contract):\n @gl.public.write\n def decide(self):\n  return gl.eq_principle.strict_eq(lambda: 'ok')\n",
    },
    {
      path: "web/src/contractClient.ts",
      size: 1200,
      purpose: "frontend_candidate",
      textExcerpt:
        "import { createClient } from 'genlayer-js';\nexport async function readContract() { return createClient({}).readContract(); }\nconst CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111';",
    },
    {
      path: "package.json",
      size: 900,
      purpose: "manifest",
      textExcerpt: '{"dependencies":{"genlayer-js":"1.0.0","next":"16.2.10"}}',
    },
    {
      path: "pnpm-lock.yaml",
      size: 6000,
      purpose: "lockfile",
      textExcerpt: "lockfileVersion: '9.0'",
    },
    {
      path: "vercel.json",
      size: 300,
      purpose: "deployment_candidate",
      textExcerpt: '{"framework":"nextjs"}',
    },
  ],
  fetchedAt: "2026-07-17T00:00:00.000Z",
  filesConsidered: 6,
  filesRetrieved: 6,
  rateLimitRemaining: 49,
  limitations: [],
};

export const simulatedWalletSnapshot: RepositorySnapshot = {
  ...likelyGenLayerSnapshot,
  files: likelyGenLayerSnapshot.files.map((file) =>
    file.path === "web/src/contractClient.ts"
      ? {
          ...file,
          textExcerpt:
            "const wallet = localStorage.getItem('wallet'); const fakeTransaction = 'ok';",
        }
      : file,
  ),
};

export const missingContractSourceSnapshot: RepositorySnapshot = {
  ...likelyGenLayerSnapshot,
  files: likelyGenLayerSnapshot.files.filter(
    (file) => file.path !== "vercel.json",
  ),
  tree: likelyGenLayerSnapshot.tree.filter(
    (entry) => entry.path !== "vercel.json",
  ),
};
