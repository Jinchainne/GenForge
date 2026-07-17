import {
  type NormalizedRepository,
  type RepositoryFile,
  type RepositorySnapshot,
  type RepositoryTreeEntry,
  RepositorySnapshotSchema,
  type ReviewErrorCode,
} from "@genforge/domain";

export type FetchLike = typeof fetch;

export interface GitHubAdapterOptions {
  fetchImpl?: FetchLike;
  token?: string;
  requestTimeoutMs?: number;
  maxTreeEntries?: number;
  maxFilesToFetch?: number;
  maxFileBytes?: number;
}

export class GitHubAdapterError extends Error {
  constructor(
    public readonly code: ReviewErrorCode,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "GitHubAdapterError";
  }
}

interface GitHubRepoResponse {
  default_branch: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  private: boolean;
}

interface GitHubBranchResponse {
  commit: {
    sha: string;
  };
}

interface GitHubTreeResponse {
  truncated: boolean;
  tree: Array<{
    path: string;
    type: "blob" | "tree";
    size?: number;
  }>;
}

interface GitHubContentResponse {
  path: string;
  size: number;
  content?: string;
  encoding?: string;
  type: "file";
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TREE_ENTRIES = 4_000;
const DEFAULT_MAX_FILES = 30;
const DEFAULT_MAX_FILE_BYTES = 200_000;

const TOP_LEVEL_FILES = new Set([
  "README.md",
  "README.mdx",
  "README.txt",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "Cargo.toml",
  "Cargo.lock",
  "go.mod",
  "go.sum",
  "vercel.json",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
]);

function buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GenForge-MVP",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestJson<T>(
  url: string,
  options: GitHubAdapterOptions,
): Promise<{ data: T; rateLimitRemaining: number | null }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const response = await fetchImpl(url, {
    headers: buildHeaders(options.token),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  const rateLimitRemainingHeader = response.headers.get(
    "x-ratelimit-remaining",
  );
  const rateLimitRemaining = rateLimitRemainingHeader
    ? Number(rateLimitRemainingHeader)
    : null;

  if (!response.ok) {
    const bodyText = await response.text();
    const lowerBody = bodyText.toLowerCase();

    if (response.status === 403 && rateLimitRemaining === 0) {
      throw new GitHubAdapterError(
        "RATE_LIMITED",
        "GitHub API rate limit reached.",
      );
    }
    if (response.status === 404) {
      throw new GitHubAdapterError(
        "REPOSITORY_NOT_FOUND",
        "Repository was not found on GitHub.",
      );
    }
    if (response.status === 403 && lowerBody.includes("private")) {
      throw new GitHubAdapterError(
        "PRIVATE_REPOSITORY",
        "Repository is private or not accessible.",
      );
    }
    if (response.status === 422 && lowerBody.includes("too large")) {
      throw new GitHubAdapterError(
        "RESPONSE_TOO_LARGE",
        "Repository response exceeded the configured size limits.",
      );
    }

    throw new GitHubAdapterError(
      "GITHUB_UNAVAILABLE",
      `GitHub API request failed with status ${response.status}.`,
      [bodyText.slice(0, 200)],
    );
  }

  const data = (await response.json()) as T;
  return { data, rateLimitRemaining };
}

type CandidatePurpose = RepositoryFile["purpose"];

interface CandidateFile {
  path: string;
  purpose: CandidatePurpose;
  priority: number;
}

function rankFile(path: string): CandidateFile | null {
  const name = path.split("/").at(-1) ?? path;
  const lowerPath = path.toLowerCase();
  const lowerName = name.toLowerCase();

  if (TOP_LEVEL_FILES.has(name) && !path.includes("/")) {
    const purpose: CandidatePurpose =
      lowerName === "readme.md" ||
      lowerName === "readme.mdx" ||
      lowerName === "readme.txt"
        ? "readme"
        : lowerName.includes("lock")
          ? "lockfile"
          : lowerName === "vercel.json" || lowerName.includes("docker")
            ? "deployment_candidate"
            : "manifest";
    return { path, purpose, priority: 100 };
  }

  if (
    lowerPath.endsWith(".py") &&
    /(contract|validator|judge|oracle|genlayer|intelligent)/.test(lowerPath)
  ) {
    return { path, purpose: "contract_candidate", priority: 95 };
  }

  if (
    /(contracts|intelligent_contract|validators|judges)\//.test(lowerPath) &&
    /\.(py|ts|tsx|js|jsx|sol)$/.test(lowerPath)
  ) {
    return { path, purpose: "contract_candidate", priority: 92 };
  }

  if (
    /(frontend|app|apps|web|ui|src|components|pages)\//.test(lowerPath) &&
    /\.(ts|tsx|js|jsx|json)$/.test(lowerPath) &&
    /(wallet|contract|address|provider|client|config|store|state)/.test(
      lowerPath,
    )
  ) {
    return { path, purpose: "frontend_candidate", priority: 88 };
  }

  if (
    lowerPath.startsWith(".github/workflows/") ||
    /(deploy|vercel|docker|compose|netlify)/.test(lowerPath)
  ) {
    return { path, purpose: "deployment_candidate", priority: 82 };
  }

  if (
    /\.(json|toml|yaml|yml|ts|js)$/.test(lowerPath) &&
    /(address|contract|network|chain|env|config)/.test(lowerPath)
  ) {
    return { path, purpose: "configuration_candidate", priority: 78 };
  }

  if (
    /(package\.json|requirements\.txt|pyproject\.toml|cargo\.toml|go\.mod)$/.test(
      lowerPath,
    )
  ) {
    return { path, purpose: "manifest", priority: 75 };
  }

  if (
    /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|cargo\.lock)$/.test(
      lowerPath,
    )
  ) {
    return { path, purpose: "lockfile", priority: 74 };
  }

  return null;
}

function selectCandidateFiles(
  tree: RepositoryTreeEntry[],
  maxFiles: number,
): CandidateFile[] {
  const ranked = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => rankFile(entry.path))
    .filter((entry): entry is CandidateFile => entry !== null);

  const seen = new Set<string>();
  const unique = ranked
    .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path))
    .filter((entry) => {
      if (seen.has(entry.path)) {
        return false;
      }
      seen.add(entry.path);
      return true;
    });

  return unique.slice(0, maxFiles);
}

async function fetchFileContent(
  normalized: NormalizedRepository,
  branch: string,
  candidate: CandidateFile,
  options: GitHubAdapterOptions,
): Promise<RepositoryFile | null> {
  const url = `https://api.github.com/repos/${normalized.owner}/${normalized.repo}/contents/${encodeURIComponent(
    candidate.path,
  )}?ref=${encodeURIComponent(branch)}`;
  const { data } = await requestJson<GitHubContentResponse>(url, options);

  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  if (data.size > maxFileBytes) {
    return null;
  }

  const encoded = data.content ?? "";
  const decoded =
    data.encoding === "base64"
      ? Buffer.from(encoded.replace(/\n/g, ""), "base64").toString("utf8")
      : undefined;

  return {
    path: data.path,
    size: data.size,
    purpose: candidate.purpose,
    textExcerpt: decoded?.slice(0, 25_000),
  };
}

export async function scanGitHubRepository(
  normalized: NormalizedRepository,
  options: GitHubAdapterOptions = {},
): Promise<RepositorySnapshot> {
  const repoUrl = `https://api.github.com/repos/${normalized.owner}/${normalized.repo}`;
  const { data: repo, rateLimitRemaining: repoRateLimit } =
    await requestJson<GitHubRepoResponse>(repoUrl, options);

  if (repo.private) {
    throw new GitHubAdapterError(
      "PRIVATE_REPOSITORY",
      "Private repositories are not supported in this release.",
    );
  }

  const branchUrl = `https://api.github.com/repos/${normalized.owner}/${normalized.repo}/branches/${encodeURIComponent(
    repo.default_branch,
  )}`;
  const { data: branch, rateLimitRemaining: branchRateLimit } =
    await requestJson<GitHubBranchResponse>(branchUrl, options);

  const treeUrl = `https://api.github.com/repos/${normalized.owner}/${normalized.repo}/git/trees/${encodeURIComponent(
    repo.default_branch,
  )}?recursive=1`;
  const { data: treeResponse, rateLimitRemaining: treeRateLimit } =
    await requestJson<GitHubTreeResponse>(treeUrl, options);

  const tree: RepositoryTreeEntry[] = treeResponse.tree.map((entry) => ({
    path: entry.path,
    type: entry.type,
    size: entry.size ?? null,
  }));

  const maxTreeEntries = options.maxTreeEntries ?? DEFAULT_MAX_TREE_ENTRIES;
  if (treeResponse.truncated || tree.length > maxTreeEntries) {
    throw new GitHubAdapterError(
      "RESPONSE_TOO_LARGE",
      "Repository tree exceeded the configured size limit for this MVP.",
      [
        `Tree entries returned: ${tree.length}`,
        `Truncated response: ${String(treeResponse.truncated)}`,
      ],
    );
  }

  const maxFilesToFetch = options.maxFilesToFetch ?? DEFAULT_MAX_FILES;
  const candidates = selectCandidateFiles(tree, maxFilesToFetch);
  const retrieved: RepositoryFile[] = [];
  const limitations: string[] = [];

  for (const candidate of candidates) {
    try {
      const file = await fetchFileContent(
        normalized,
        repo.default_branch,
        candidate,
        options,
      );
      if (file) {
        retrieved.push(file);
      } else {
        limitations.push(
          `Skipped ${candidate.path} because it exceeded the file size limit.`,
        );
      }
    } catch (error) {
      if (error instanceof GitHubAdapterError) {
        limitations.push(
          `Skipped ${candidate.path} because GitHub returned ${error.code}.`,
        );
        continue;
      }
      throw error;
    }
  }

  const snapshot = RepositorySnapshotSchema.parse({
    metadata: {
      owner: normalized.owner,
      repo: normalized.repo,
      defaultBranch: repo.default_branch,
      commitSha: branch.commit.sha,
      description: repo.description,
      visibility: repo.private ? "private" : "public",
      stars: repo.stargazers_count,
      htmlUrl: repo.html_url,
    },
    tree,
    files: retrieved,
    fetchedAt: new Date().toISOString(),
    filesConsidered: candidates.length,
    filesRetrieved: retrieved.length,
    rateLimitRemaining: treeRateLimit ?? branchRateLimit ?? repoRateLimit,
    limitations,
  });

  return snapshot;
}
