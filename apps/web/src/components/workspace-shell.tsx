"use client";

import { useState } from "react";
import {
  getDisputeSubmissionConfigIssues,
  getPublicGenLayerConfig,
  getSubmissionConfigIssues,
  getTokenDeploymentConfigIssues,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";
import { ContractOpsDashboard } from "./contract-ops-dashboard";
import { EnterpriseDisputeDashboard } from "./enterprise-dispute-dashboard";
import { ReviewDashboard } from "./review-dashboard";
import { TokenLaunchDashboard } from "./token-launch-dashboard";

type Workspace =
  | "repo_review"
  | "enterprise_dispute"
  | "contract_ops"
  | "token_launch";
type TreeGroupId = "cases" | "chain" | "evidence";

const workspaceNodes: Array<{
  id: Workspace;
  group: TreeGroupId;
  label: string;
  code: string;
  summary: string;
}> = [
  {
    id: "enterprise_dispute",
    group: "cases",
    label: "Enterprise Dispute",
    code: "CASE-01",
    summary:
      "Bilateral intake, evidence packet, counterparty readiness, and wallet escalation.",
  },
  {
    id: "repo_review",
    group: "evidence",
    label: "Repository Review",
    code: "REV-02",
    summary:
      "Read-only GitHub evidence, GenLayer gate checks, scoring, and remediation.",
  },
  {
    id: "contract_ops",
    group: "chain",
    label: "Contract Ops",
    code: "OPS-03",
    summary:
      "CLI status, deployment blockers, public runtime config, and operator commands.",
  },
  {
    id: "token_launch",
    group: "chain",
    label: "Token Launch",
    code: "TOK-04",
    summary:
      "Wallet-signed project token deployment through a configured GenLayer factory.",
  },
];

const treeGroups: Array<{
  id: TreeGroupId;
  label: string;
  description: string;
}> = [
  {
    id: "cases",
    label: "Case Files",
    description: "Commercial adjudication workspace",
  },
  {
    id: "evidence",
    label: "Evidence Desk",
    description: "Repository review and confidence",
  },
  {
    id: "chain",
    label: "GenLayer Ops",
    description: "Runtime, wallet, and deploy path",
  },
];

export function WorkspaceShell() {
  const [workspace, setWorkspace] = useState<Workspace>("enterprise_dispute");
  const [openGroups, setOpenGroups] = useState<Record<TreeGroupId, boolean>>({
    cases: true,
    evidence: true,
    chain: true,
  });
  const publicConfig = getPublicGenLayerConfig();
  const walletIssues = getWalletConfigIssues(publicConfig);
  const reviewSubmissionIssues = getSubmissionConfigIssues(publicConfig);
  const disputeSubmissionIssues = getDisputeSubmissionConfigIssues(publicConfig);
  const tokenDeploymentIssues = getTokenDeploymentConfigIssues(publicConfig);
  const activeNode =
    workspaceNodes.find((item) => item.id === workspace) ?? workspaceNodes[0];

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
    {
      label: "Token factory",
      status: tokenDeploymentIssues.length === 0 ? "ready" : "needs env",
      detail:
        tokenDeploymentIssues.length === 0
          ? publicConfig.tokenFactoryAddress ?? "Configured"
          : "Awaiting NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS.",
    },
  ];

  function toggleGroup(group: TreeGroupId) {
    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }

  function selectWorkspace(nextWorkspace: Workspace) {
    setWorkspace(nextWorkspace);
    globalThis.requestAnimationFrame(() => {
      document
        .getElementById("workspace-page")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-nav" aria-label="GenForge workspace menu">
        <div className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">
            GF
          </span>
          <div>
            <div className="eyebrow">GenForge Control Surface</div>
            <strong>GenLayer workbench</strong>
          </div>
        </div>

        <nav className="workspace-tree" aria-label="Workspace tree">
          {treeGroups.map((group) => {
            const groupNodes = workspaceNodes.filter(
              (node) => node.group === group.id,
            );

            return (
              <section key={group.id} className="tree-group">
                <button
                  type="button"
                  className="tree-group-button"
                  aria-expanded={openGroups[group.id]}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="tree-caret" aria-hidden="true">
                    {openGroups[group.id] ? "v" : ">"}
                  </span>
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.description}</small>
                  </span>
                </button>
                {openGroups[group.id] ? (
                  <div className="tree-branch">
                    {groupNodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={
                          workspace === node.id
                            ? "tree-node tree-node-active"
                            : "tree-node"
                        }
                        aria-current={workspace === node.id ? "page" : undefined}
                        onClick={() => selectWorkspace(node.id)}
                      >
                        <span className="tree-line" aria-hidden="true" />
                        <span className="tree-node-code">{node.code}</span>
                        <span>{node.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>

        <div className="registry-list nav-registry" aria-label="Runtime registry">
          {registry.map((item) => (
            <article key={item.label} className="registry-item">
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <span
                className={`registry-status registry-${item.status.replaceAll(
                  " ",
                  "-",
                )}`}
              >
                {item.status}
              </span>
            </article>
          ))}
        </div>
      </aside>

      <section className="workspace-stage">
        <header className="workspace-topbar">
          <div>
            <div className="eyebrow">{activeNode.code}</div>
            <h1>{activeNode.label}</h1>
            <p>{activeNode.summary}</p>
          </div>
          <div className="workspace-switcher" role="tablist" aria-label="Workspaces">
            {workspaceNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={
                  workspace === node.id
                    ? "workspace-tab workspace-tab-active"
                    : "workspace-tab"
                }
                onClick={() => selectWorkspace(node.id)}
              >
                {node.label}
              </button>
            ))}
          </div>
        </header>

        <section
          id="workspace-page"
          key={workspace}
          className="workspace-page-turn"
          aria-live="polite"
        >
          {workspace === "enterprise_dispute" ? (
            <EnterpriseDisputeDashboard />
          ) : null}
          {workspace === "repo_review" ? <ReviewDashboard /> : null}
          {workspace === "contract_ops" ? <ContractOpsDashboard /> : null}
          {workspace === "token_launch" ? <TokenLaunchDashboard /> : null}
        </section>
      </section>
    </main>
  );
}
