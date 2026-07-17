"use client";

import { useState } from "react";
import { ReviewDashboard } from "./review-dashboard";
import { EnterpriseDisputeDashboard } from "./enterprise-dispute-dashboard";

type Workspace = "repo_review" | "enterprise_dispute";

export function WorkspaceShell() {
  const [workspace, setWorkspace] = useState<Workspace>("enterprise_dispute");

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <div className="eyebrow">GenForge Control Surface</div>
          <h1 className="workspace-title">
            Enterprise-grade adjudication for repository, contract, and bilateral dispute workflows
          </h1>
        </div>
        <div className="workspace-switcher" role="tablist" aria-label="Workspaces">
          <button
            type="button"
            className={workspace === "enterprise_dispute" ? "workspace-tab workspace-tab-active" : "workspace-tab"}
            onClick={() => setWorkspace("enterprise_dispute")}
          >
            Enterprise Dispute
          </button>
          <button
            type="button"
            className={workspace === "repo_review" ? "workspace-tab workspace-tab-active" : "workspace-tab"}
            onClick={() => setWorkspace("repo_review")}
          >
            Repository Review
          </button>
        </div>
      </header>

      {workspace === "enterprise_dispute" ? (
        <EnterpriseDisputeDashboard />
      ) : (
        <ReviewDashboard />
      )}
    </main>
  );
}
