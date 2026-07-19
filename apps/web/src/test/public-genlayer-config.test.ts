import { describe, expect, it } from "vitest";
import { getTokenDeploymentConfigIssues } from "@/lib/public-genlayer-config";

describe("token deployment public config", () => {
  it("blocks token deployment when the factory address is missing", () => {
    const issues = getTokenDeploymentConfigIssues({
      network: "studionet",
      rpcUrl: "https://studio.genlayer.com/api",
      studioUrl: "https://studio.genlayer.com",
      tokenFactoryMethod: "deploy_token",
    });

    expect(issues).toContain(
      "NEXT_PUBLIC_GENLAYER_TOKEN_FACTORY_ADDRESS is missing.",
    );
  });

  it("allows readiness when network, rpc, factory, and method are configured", () => {
    const issues = getTokenDeploymentConfigIssues({
      network: "studionet",
      rpcUrl: "https://studio.genlayer.com/api",
      studioUrl: "https://studio.genlayer.com",
      tokenFactoryAddress: "0x123",
      tokenFactoryMethod: "deploy_token",
    });

    expect(issues).toEqual([]);
  });
});
