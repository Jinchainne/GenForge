import { describe, expect, it } from "vitest";
import { normalizeGitHubRepositoryUrl } from "@genforge/domain";

describe("normalizeGitHubRepositoryUrl", () => {
  it("normalizes canonical repository URLs", () => {
    expect(
      normalizeGitHubRepositoryUrl("https://github.com/openai/codex"),
    ).toMatchObject({
      owner: "openai",
      repo: "codex",
      repositoryUrl: "https://github.com/openai/codex",
    });
  });

  it("strips .git and extra path segments", () => {
    expect(
      normalizeGitHubRepositoryUrl(
        "https://github.com/openai/codex.git/tree/main",
      ),
    ).toMatchObject({
      owner: "openai",
      repo: "codex",
    });
  });

  it("rejects non-https urls", () => {
    expect(() =>
      normalizeGitHubRepositoryUrl("http://github.com/openai/codex"),
    ).toThrow(/https/i);
  });

  it("rejects unsupported hosts", () => {
    expect(() =>
      normalizeGitHubRepositoryUrl("https://gitlab.com/openai/codex"),
    ).toThrow(/github\.com/i);
  });
});
