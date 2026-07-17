import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "@/components/workspace-shell";

describe("WorkspaceShell", () => {
  it("renders the enterprise workspace by default", () => {
    render(<WorkspaceShell />);

    expect(screen.getByText("GenForge Control Surface")).toBeInTheDocument();
    expect(screen.getByText("Live capability map")).toBeInTheDocument();
    expect(screen.getByText("Enterprise-grade adjudication for repository, contract, and bilateral dispute workflows")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enterprise Dispute" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Case title")).toBeInTheDocument();
    expect(screen.getByText("Generate Enterprise Dossier")).toBeInTheDocument();
  });
});
