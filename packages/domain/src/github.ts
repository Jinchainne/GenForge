import { z } from "zod";

export const NormalizedRepositorySchema = z.object({
  host: z.literal("github.com"),
  owner: z.string().min(1),
  repo: z.string().min(1),
  repositoryUrl: z.url(),
  apiBaseUrl: z.literal("https://api.github.com"),
  canonicalSlug: z.string().min(3),
});

export type NormalizedRepository = z.infer<typeof NormalizedRepositorySchema>;

export type NormalizeRepositoryUrlErrorCode =
  "INVALID_REPOSITORY_URL" | "UNSUPPORTED_HOST";

export class NormalizeRepositoryUrlError extends Error {
  constructor(
    public readonly code: NormalizeRepositoryUrlErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NormalizeRepositoryUrlError";
  }
}

export function normalizeGitHubRepositoryUrl(
  rawInput: string,
): NormalizedRepository {
  const input = rawInput.trim();
  if (!input) {
    throw new NormalizeRepositoryUrlError(
      "INVALID_REPOSITORY_URL",
      "Repository URL is required.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new NormalizeRepositoryUrlError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must be a valid absolute URL.",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new NormalizeRepositoryUrlError(
      "INVALID_REPOSITORY_URL",
      "Only https:// GitHub repository URLs are supported.",
    );
  }

  if (parsed.hostname !== "github.com") {
    throw new NormalizeRepositoryUrlError(
      "UNSUPPORTED_HOST",
      "Only github.com repositories are supported in this release.",
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    throw new NormalizeRepositoryUrlError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must include both owner and repository name.",
    );
  }

  const [owner, repoSegment] = segments;
  const repo = repoSegment?.replace(/\.git$/i, "");
  if (!owner || !repo) {
    throw new NormalizeRepositoryUrlError(
      "INVALID_REPOSITORY_URL",
      "Repository URL must include both owner and repository name.",
    );
  }

  const repositoryUrl = `https://github.com/${owner}/${repo}`;
  return NormalizedRepositorySchema.parse({
    host: "github.com",
    owner,
    repo,
    repositoryUrl,
    apiBaseUrl: "https://api.github.com",
    canonicalSlug: `${owner}/${repo}`,
  });
}
