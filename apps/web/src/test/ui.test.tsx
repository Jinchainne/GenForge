import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "@/components/workspace-shell";

describe("WorkspaceShell", () => {
  it("renders the trade document case workspace by default", () => {
    render(<WorkspaceShell />);

    expect(screen.getByText("Trade document console")).toBeInTheDocument();
    expect(
      screen.getByText("Use this for goods-trade dispute evidence."),
    ).toBeInTheDocument();
    expect(screen.getByText("Trade Desk")).toBeInTheDocument();
    expect(screen.getByText("Wallet runtime")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Trade Case" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Runtime Ops" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Settlement Token" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Trade case title")).toBeInTheDocument();
    expect(screen.getByText("Import Documents")).toBeInTheDocument();
    expect(screen.getByText("Build Trade Case")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Connect Wallet" }),
    ).toHaveLength(1);
  });
});
