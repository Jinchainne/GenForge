"use client";

import { useState } from "react";
import { ReviewDashboard } from "./review-dashboard";
import { EnterpriseDisputeDashboard } from "./enterprise-dispute-dashboard";
import { ContractOpsDashboard } from "./contract-ops-dashboard";
import {
  getDisputeSubmissionConfigIssues,
  getPublicGenLayerConfig,
  getSubmissionConfigIssues,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";

type Workspace = "repo_review" | "enterprise_dispute" | "contract_ops";

const capabilityCards = [
  {
    id: "dispute",
    title: "Enterprise Dispute",
    summary:
      "Bilateral intake, counterparty packet, wallet approval path, and validator-backed settlement planning.",
  },
  {
    id: "review",
    title: "Repository Review",
    summary:
      "Deterministic GitHub evidence collection, gate checks, fix guidance, and GenLayer review escalation.",
  },
  {
    id: "audit",
    title: "Audit Trail",
    summary:
      "Operational history, readiness state, and export-ready evidence boundaries for commercial review teams.",
  },
  {
    id: "ops",
    title: "Contract Ops",
    summary:
      "Real CLI status, deploy blockers, public runtime envs, and operator deployment commands for GenLayer contracts.",
  },
];

export function WorkspaceShell() {
  const [workspace, setWorkspace] = useState<Workspace>("enterprise_dispute");
  const publicConfig = getPublicGenLayerConfig();
  const walletIssues = getWalletConfigIssues(publicConfig);
  const reviewSubmissionIssues = getSubmissionConfigIssues(publicConfig);
  const disputeSubmissionIssues = getDisputeSubmissionConfigIssues(publicConfig);

  const registry = [
    {
      label: "Wallet runtime",
      status: walletIssues.length === 0 ? "ready" : "blocked",
      detail:
        walletIssues.length === 0
          ? `${publicConfig.network ?? "unknown"} via ${publicConfig.rpcUrl ?? "missing rpc"}`
          : walletIssues.join(" "),
    },
    {
      label: "Repository contract",
      status: reviewSubmissionIssues.length === 0 ? "ready" : "needs env",
      detail:
        reviewSubmissionIssues.length === 0
          ? publicConfig.contractAddress ?? "Configured"
          : "Awaiting NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS.",
    },
    {
      label: "Dispute contract",
      status: disputeSubmissionIssues.length === 0 ? "ready" : "needs env",
      detail:
        disputeSubmissionIssues.length === 0
          ? publicConfig.disputeContractAddress ?? "Configured"
          : "Awaiting NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS.",
    },
  ];

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <div className="eyebrow">GenForge Control Surface</div>
          <h1 className="workspace-title">
            Enterprise-grade adjudication for repository, contract, and bilateral dispute workflows
          </h1>
          <p className="workspace-subtitle">
            Pattern-driven operating console for legal ops, procurement, and
            GenLayer-native repository evaluation. Live states are only shown
            when runtime and contract paths are actually configured.
          </p>
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
          <button
            type="button"
            className={workspace === "contract_ops" ? "workspace-tab workspace-tab-active" : "workspace-tab"}
            onClick={() => setWorkspace("contract_ops")}
          >
            Contract Ops
          </button>
        </div>
      </header>

      <section className="workspace-deck">
        <article className="panel workspace-hero-card">
          <div className="eyebrow">GenLayer Operating Model</div>
          <h2 className="workspace-hero-title">
            Design intelligence for adjudication, not just a prettier shell.
          </h2>
          <p>
            Inspired by design-system-first tooling, this surface is organized
            around operational truth: runtime readiness, capability ownership,
            bounded evidence, and wallet-controlled escalation.
          </p>
          <div className="workspace-chip-row" aria-label="System rails">
            <span>Pattern: control tower</span>
            <span>Style: bounded evidence</span>
            <span>Rule: no fake consensus</span>
            <span>Output: commercial workflow</span>
          </div>
        </article>

        <aside className="panel workspace-registry-card">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Runtime Registry</div>
              <h3>Live capability map</h3>
            </div>
            <span>{publicConfig.network ?? "network missing"}</span>
          </div>
          <div className="registry-list">
            {registry.map((item) => (
              <article key={item.label} className="registry-item">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className={`registry-status registry-${item.status.replaceAll(" ", "-")}`}>
                  {item.status}
                </span>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="workspace-capability-grid" aria-label="Capability index">
        {capabilityCards.map((card) => (
          <article key={card.id} className="panel capability-card">
            <div className="eyebrow">Capability</div>
            <h3>{card.title}</h3>
            <p>{card.summary}</p>
          </article>
        ))}
      </section>

      {workspace === "enterprise_dispute" ? <EnterpriseDisputeDashboard /> : null}
      {workspace === "repo_review" ? <ReviewDashboard /> : null}
      {workspace === "contract_ops" ? <ContractOpsDashboard /> : null}
    </main>
  );
}
