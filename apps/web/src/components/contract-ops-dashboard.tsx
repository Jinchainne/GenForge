"use client";

import { useEffect, useState } from "react";

type OpsStatusResponse = {
  ok: true;
  status: {
    cliAvailable: boolean;
    operatorDeployEnabled: boolean;
    observedAt: string;
    network: {
      alias: string;
      name: string;
      chainId: string;
      rpc: string;
      mainContract: string;
      explorer: string;
    } | null;
    account: {
      name: string;
      address: string;
      balance: string;
      network: string;
      status: string;
      active: boolean;
    } | null;
    publicRuntime: {
      network?: string;
      rpcUrl?: string;
      reviewContractAddress?: string;
      disputeContractAddress?: string;
      tokenFactoryAddress?: string;
      tokenFactoryMethod?: string;
    };
    browserSubmissionReadiness: {
      status: "ready" | "blocked";
      blockers: string[];
    };
    tokenDeploymentReadiness: {
      status: "ready" | "blocked";
      blockers: string[];
    };
    deployReadiness: {
      status:
        | "ready_to_deploy"
        | "blocked"
        | "cli_unavailable"
        | "operator_disabled";
      blockers: string[];
      commands: Array<{
        id: "review" | "dispute" | "token_factory";
        label: string;
        command: string;
      }>;
    };
  };
};

type DeployResponse = {
  ok: boolean;
  result: {
    ok: boolean;
    contract: "review" | "dispute" | "token_factory";
    command: string;
    stdout: string;
    stderr: string;
    observedAt: string;
  };
};

export function ContractOpsDashboard() {
  const [status, setStatus] = useState<OpsStatusResponse["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deployState, setDeployState] = useState<{
    status: "idle" | "running" | "done" | "failed";
    message: string;
    stdout?: string;
    stderr?: string;
  }>({
    status: "idle",
    message:
      "Refresh the operator status to inspect live deployment blockers and contract readiness.",
  });
  const canAttemptDeploy =
    status?.deployReadiness.status === "ready_to_deploy" &&
    deployState.status !== "running";
  const operatorRailState = status?.deployReadiness.status ?? "idle";
  const browserRailState = status?.browserSubmissionReadiness.status ?? "idle";
  const tokenRailState = status?.tokenDeploymentReadiness.status ?? "idle";

  async function loadStatus(options?: { showLoading?: boolean }) {
    if (options?.showLoading ?? true) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await fetch("/api/ops/genlayer");
      const payload = (await response.json()) as OpsStatusResponse;
      if (!payload.ok) {
        throw new Error("Operator status endpoint returned an invalid response.");
      }
      setStatus(payload.status);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load operator status.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const response = await fetch("/api/ops/genlayer");
        const payload = (await response.json()) as OpsStatusResponse;
        if (!payload.ok) {
          throw new Error(
            "Operator status endpoint returned an invalid response.",
          );
        }
        if (mounted) {
          setStatus(payload.status);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load operator status.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleDeploy(contract: "review" | "dispute" | "token_factory") {
    setDeployState({
      status: "running",
      message: `Running operator deployment for the ${contract} contract...`,
    });

    try {
      const response = await fetch("/api/ops/genlayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contract }),
      });
      const payload = (await response.json()) as DeployResponse;

      setDeployState({
        status: payload.ok ? "done" : "failed",
        message: payload.ok
          ? "Deployment command completed. Review stdout and refresh the operator registry."
          : "Deployment command failed or was blocked. Review stderr for the exact blocker.",
        stdout: payload.result.stdout,
        stderr: payload.result.stderr,
      });
      await loadStatus();
    } catch (error) {
      setDeployState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Deployment request failed unexpectedly.",
      });
    }
  }

  return (
    <section className="dispute-shell">
      <div className="submission-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Operator Registry</div>
              <h3>Live GenLayer status</h3>
            </div>
            <span>{loading ? "loading" : operatorRailState}</span>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadStatus()}
              disabled={loading}
            >
              Refresh Status
            </button>
          </div>
          {errorMessage ? <p className="error-callout">{errorMessage}</p> : null}
          <dl className="source-grid">
            <div>
              <dt>CLI</dt>
              <dd>{status?.cliAvailable ? "available" : "unavailable"}</dd>
            </div>
            <div>
              <dt>Observed at</dt>
              <dd>{status?.observedAt ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{status?.network?.name ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd>{status?.network?.chainId ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{status?.account?.name ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{status?.account?.address ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{status?.account?.balance ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Operator deploy</dt>
              <dd>{status?.operatorDeployEnabled ? "enabled" : "disabled"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel hero-panel workbench-rail">
          <div className="eyebrow">Contract Operations</div>
          <h2>Real deployment readiness, not simulated success</h2>
          <p>
            Inspect CLI, account funding, public runtime config, and exact
            blockers before any operator deployment command is allowed.
          </p>
          <div className="status-rail" aria-label="Operator workflow">
            <span className="done">CLI</span>
            <span className={status?.account ? "done" : "active"}>Account</span>
            <span
              className={
                status?.deployReadiness.status === "ready_to_deploy"
                  ? "done"
                  : "active"
              }
            >
              Deploy
            </span>
            <span
              className={
                status?.browserSubmissionReadiness.status === "ready"
                  ? "done"
                  : "active"
              }
            >
              Wallet
            </span>
            <span
              className={
                status?.tokenDeploymentReadiness.status === "ready"
                  ? "done"
                  : "active"
              }
            >
              Token
            </span>
          </div>
          <dl className="rail-facts">
            <div>
              <dt>Deployment rule</dt>
              <dd>Requires CLI, funded account, and explicit operator flag</dd>
            </div>
            <div>
              <dt>Browser rule</dt>
              <dd>Wallet can submit only to configured public addresses</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="content-grid">
        <div className="primary-column">
          <section className="panel">
            <div className="panel-header">
              <h3>Deploy Readiness</h3>
              <span>{operatorRailState}</span>
            </div>
            {status?.deployReadiness.blockers.length ? (
              <div className="error-callout">
                <strong>Current blockers</strong>
                <ul className="stack-list compact-list">
                  {status.deployReadiness.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="callout">
                <strong>No blockers detected</strong>
                <p>
                  The operator registry is ready to attempt a live contract
                  deployment.
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Browser Submission Readiness</h3>
              <span>{browserRailState}</span>
            </div>
            {status?.browserSubmissionReadiness.blockers.length ? (
              <div className="error-callout">
                <strong>Public wallet blockers</strong>
                <ul className="stack-list compact-list">
                  {status.browserSubmissionReadiness.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="callout">
                <strong>Browser wallet path is configured</strong>
                <p>
                  Wallet submission can target the configured trade dispute
                  contract from the hosted interface.
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Token Deployment Readiness</h3>
              <span>{tokenRailState}</span>
            </div>
            {status?.tokenDeploymentReadiness.blockers.length ? (
              <div className="error-callout">
                <strong>Token factory blockers</strong>
                <ul className="stack-list compact-list">
                  {status.tokenDeploymentReadiness.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="callout">
                <strong>Token factory path is configured</strong>
                <p>
                  The Settlement Token workspace can send wallet-signed credit
                  requests to the configured GenLayer factory contract.
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Operator Commands</h3>
              <span>{status?.deployReadiness.commands.length ?? 0}</span>
            </div>
            <div className="history-list">
              {status?.deployReadiness.commands.map((item) => (
                <article key={item.id} className="history-item">
                  <header>
                    <div>
                      <strong>{item.label}</strong>
                      <p className="mono-line">{item.command}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleDeploy(item.id)}
                      disabled={!canAttemptDeploy}
                    >
                      Deploy
                    </button>
                  </header>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Deploy Output</h3>
              <span>{deployState.status}</span>
            </div>
            <p>{deployState.message}</p>
            {deployState.stdout ? (
              <div className="callout">
                <strong>stdout</strong>
                <p className="mono-line">{deployState.stdout}</p>
              </div>
            ) : null}
            {deployState.stderr ? (
              <div className="error-callout">
                <strong>stderr</strong>
                <p className="mono-line">{deployState.stderr}</p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="secondary-column">
          <section className="panel">
            <div className="panel-header">
              <h3>Public Runtime</h3>
              <span>browser env</span>
            </div>
            <dl className="source-grid">
              <div>
                <dt>Public network</dt>
                <dd>{status?.publicRuntime.network ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Public RPC</dt>
                <dd>{status?.publicRuntime.rpcUrl ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Review contract</dt>
                <dd>{status?.publicRuntime.reviewContractAddress ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Dispute contract</dt>
                <dd>{status?.publicRuntime.disputeContractAddress ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Token factory</dt>
                <dd>{status?.publicRuntime.tokenFactoryAddress ?? "Missing"}</dd>
              </div>
              <div>
                <dt>Token method</dt>
                <dd>{status?.publicRuntime.tokenFactoryMethod ?? "Missing"}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Go-Live Playbook</h3>
              <span>official path</span>
            </div>
            <ul className="stack-list">
              <li>
                Fund the active account with GEN. Official GenLayer docs list a
                built-in faucet in the account selector for Localnet and
                Studionet, and `testnet-faucet.genlayer.foundation` for Asimov
                and Bradbury.
              </li>
              <li>
                Deploy from a secure operator environment where the `genlayer`
                CLI is installed and `GENFORGE_ENABLE_OPERATOR_DEPLOY=true`.
              </li>
              <li>
                After deployment, write the real contract addresses into
                `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` and
                `NEXT_PUBLIC_GENLAYER_DISPUTE_CONTRACT_ADDRESS`, then redeploy
                `apps/web`.
              </li>
              <li>
                Use the application wallet flow only after the public runtime is
                green; wallet connectivity alone is not proof of deployed
                GenLayer judges.
              </li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Network Registry</h3>
              <span>{status?.network?.alias ?? "unknown"}</span>
            </div>
            <ul className="stack-list">
              <li>
                <strong>RPC:</strong> {status?.network?.rpc ?? "Not loaded"}
              </li>
              <li>
                <strong>Main contract:</strong>{" "}
                {status?.network?.mainContract ?? "Not loaded"}
              </li>
              <li>
                <strong>Explorer:</strong>{" "}
                {status?.network?.explorer ?? "Not loaded"}
              </li>
              <li>
                <strong>Studio:</strong> https://studio.genlayer.com
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
