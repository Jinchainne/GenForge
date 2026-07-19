import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "@/components/workspace-shell";

describe("WorkspaceShell", () => {
  it("renders the builder project review workspace by default", () => {
    render(<WorkspaceShell />);

    expect(screen.getByText("Builder review console")).toBeInTheDocument();
    expect(
      screen.getByText("Use this to judge GenLayer builder projects."),
    ).toBeInTheDocument();
    expect(screen.getByText("Submission Gate")).toBeInTheDocument();
    expect(screen.getByText("Wallet runtime")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Project Review" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Runtime Ops" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Reward Token" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Public GitHub repository URL"),
    ).toBeInTheDocument();
    expect(screen.getByText("Review Builder Project")).toBeInTheDocument();
  });
});
