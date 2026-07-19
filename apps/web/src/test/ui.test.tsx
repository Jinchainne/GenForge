import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "@/components/workspace-shell";

describe("WorkspaceShell", () => {
  it("renders the enterprise workspace by default", () => {
    render(<WorkspaceShell />);

    expect(screen.getByText("GenForge Control Surface")).toBeInTheDocument();
    expect(screen.getByText("GenLayer workbench")).toBeInTheDocument();
    expect(screen.getByText("Case Files")).toBeInTheDocument();
    expect(screen.getByText("Wallet runtime")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Enterprise Dispute" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Contract Ops" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Token Launch" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Case title")).toBeInTheDocument();
    expect(screen.getByText("Generate Enterprise Dossier")).toBeInTheDocument();
  });
});
