import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewDashboard } from "@/components/review-dashboard";

describe("ReviewDashboard", () => {
  it("renders the submission form and review copy", () => {
    render(<ReviewDashboard />);

    expect(screen.getByText("GenForge")).toBeInTheDocument();
    expect(screen.getByText("Ready for Repository Intake")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Public GitHub repository URL"),
    ).toBeInTheDocument();
  });
});
