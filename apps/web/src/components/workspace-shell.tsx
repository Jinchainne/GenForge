"use client";

import { useState } from "react";
import {
  connectBrowserWallet,
  disconnectBrowserWallet,
  getBrowserWalletLabel,
  isBrowserWalletAvailable,
} from "@genforge/genlayer-client";
import {
  getDisputeSubmissionConfigIssues,
  getPublicGenLayerConfig,
  getTokenDeploymentConfigIssues,
  getWalletConfigIssues,
} from "@/lib/public-genlayer-config";
import type { WalletConnectionState } from "@/lib/review-workflow";
import { ContractOpsDashboard } from "./contract-ops-dashboard";
import { EnterpriseDisputeDashboard } from "./enterprise-dispute-dashboard";
import { TokenLaunchDashboard } from "./token-launch-dashboard";

type Workspace =
  | "enterprise_dispute"
  | "contract_ops"
  | "token_launch";
type TreeGroupId = "cases" | "chain";

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
    label: "Trade Case",
    code: "DOC-01",
    summary: "Import PO, invoice, B/L, packing list, and trade correspondence.",
  },
  {
    id: "contract_ops",
    group: "chain",
    label: "Runtime Ops",
    code: "OPS-03",
    summary: "Contracts, wallet runtime, receipts, and operator commands.",
  },
  {
    id: "token_launch",
    group: "chain",
    label: "Settlement Token",
    code: "TOK-04",
    summary: "Wallet-signed settlement or credit records.",
  },
];

const treeGroups: Array<{
  id: TreeGroupId;
  label: string;
  description: string;
}> = [
  {
    id: "cases",
    label: "Trade Desk",
    description: "Goods, contracts, and document evidence",
  },
  {
    id: "chain",
    label: "Chain Controls",
    description: "Wallet, contracts, receipts, settlement",
  },
];

export function WorkspaceShell() {
  const [workspace, setWorkspace] = useState<Workspace>("enterprise_dispute");
  const [openGroups, setOpenGroups] = useState<Record<TreeGroupId, boolean>>({
    cases: true,
    chain: true,
  });
  const [walletBusy, setWalletBusy] = useState(false);
  const publicConfig = getPublicGenLayerConfig();
  const walletIssues = getWalletConfigIssues(publicConfig);
  const disputeSubmissionIssues = getDisputeSubmissionConfigIssues(publicConfig);
  const tokenDeploymentIssues = getTokenDeploymentConfigIssues(publicConfig);
  const activeNode =
    workspaceNodes.find((item) => item.id === workspace) ?? workspaceNodes[0];
  const [wallet, setWallet] = useState<WalletConnectionState>({
    status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
    message: isBrowserWalletAvailable()
      ? "Connect a wallet to sign GenLayer trade case and settlement requests."
      : "No browser wallet provider was detected.",
    providerLabel: getBrowserWalletLabel(),
  });

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
      label: "Trade dispute contract",
      status: disputeSubmissionIssues.length === 0 ? "ready" : "needs env",
      detail:
        disputeSubmissionIssues.length === 0
          ? publicConfig.disputeContractAddress ?? "Configured"
          : "Awaiting NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS.",
    },
    {
      label: "Settlement token factory",
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

  async function handleConnectWallet() {
    if (!isBrowserWalletAvailable()) {
      setWallet({
        status: "missing_provider",
        message: "No compatible browser wallet provider was detected.",
        providerLabel: getBrowserWalletLabel(),
      });
      return;
    }

    setWalletBusy(true);
    setWallet({
      status: "connecting",
      message: "Requesting wallet access for GenLayer trade operations.",
      providerLabel: getBrowserWalletLabel(),
    });

    try {
      const connection = await connectBrowserWallet({
        network: publicConfig.network,
        rpcUrl: publicConfig.rpcUrl,
      });
      setWallet({
        status: "connected",
        address: connection.address,
        network: connection.network,
        providerLabel: getBrowserWalletLabel(),
        message: `${getBrowserWalletLabel()} connected on ${connection.network}.`,
      });
    } catch (error) {
      setWallet({
        status: "error",
        providerLabel: getBrowserWalletLabel(),
        message:
          error instanceof Error ? error.message : "Failed to connect wallet.",
      });
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleDisconnectWallet() {
    setWalletBusy(true);
    const result = await disconnectBrowserWallet();
    setWallet({
      status: isBrowserWalletAvailable() ? "disconnected" : "missing_provider",
      providerLabel: getBrowserWalletLabel(),
      message: result.message,
    });
    setWalletBusy(false);
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-nav" aria-label="GenForge workspace menu">
        <div className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">
            GF
          </span>
          <div>
            <div className="eyebrow">GenForge</div>
            <strong>Trade document console</strong>
          </div>
        </div>

        <section className="workspace-purpose" aria-label="Product purpose">
          <strong>Use this for goods-trade dispute evidence.</strong>
          <p>
            Import documents, structure buyer/seller claims, submit to GenLayer,
            then track settlement.
          </p>
        </section>

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
          <div className="workspace-actions">
            <div className="wallet-control" aria-label="Wallet connection">
              <span className={`wallet-dot wallet-${wallet.status}`} />
              <span className="wallet-label">
                {wallet.address
                  ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                  : wallet.providerLabel ?? "Wallet"}
              </span>
              {wallet.status === "connected" ? (
                <button
                  type="button"
                  className="wallet-button secondary-button"
                  onClick={handleDisconnectWallet}
                  disabled={walletBusy}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="wallet-button"
                  onClick={handleConnectWallet}
                  disabled={walletBusy || wallet.status === "connecting"}
                >
                  {wallet.status === "connecting" ? "Connecting" : "Connect Wallet"}
                </button>
              )}
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
          </div>
        </header>

        <section
          id="workspace-page"
          key={workspace}
          className="workspace-page-turn"
          aria-live="polite"
        >
          {workspace === "enterprise_dispute" ? (
            <EnterpriseDisputeDashboard
              wallet={wallet}
              walletBusy={walletBusy}
              onConnectWallet={handleConnectWallet}
              onDisconnectWallet={handleDisconnectWallet}
            />
          ) : null}
          {workspace === "contract_ops" ? <ContractOpsDashboard /> : null}
          {workspace === "token_launch" ? (
            <TokenLaunchDashboard
              wallet={wallet}
              walletBusy={walletBusy}
              onConnectWallet={handleConnectWallet}
              onDisconnectWallet={handleDisconnectWallet}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}
