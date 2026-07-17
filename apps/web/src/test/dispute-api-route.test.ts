// @vitest-environment node

import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/disputes/route";

describe("POST /api/disputes", () => {
  it("returns a structured enterprise dispute dossier", async () => {
    const response = await POST(
      new Request("http://localhost/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseTitle: "Supplier delay charge dispute",
          disputeType: "services",
          claimantName: "Alpha Manufacturing",
          respondentName: "Northwind Field Services",
          contractReference: "SLA-2026-09 section 2.4",
          claimSummary:
            "The claimant alleges repeated delayed service visits and missed remediation windows that triggered contractual service credits.",
          respondentPosition:
            "The respondent states that site access restrictions and delayed customer approvals materially contributed to the missed windows.",
          requestedRemedy:
            "Determine whether service credits apply and whether any exceptions reduce the payable amount.",
          governingTerms: "Service agreement and service credit appendix",
          amountClaimed: "USD 48,000",
          filingDate: "2026-07-17",
          evidenceItems: [
            "Signed SLA appendix describing remediation windows",
            "Ticket log showing four missed deadlines",
            "Email thread disputing customer-caused delay",
          ],
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.report.decision).toBe("ACCEPT_FOR_SCORING");
    expect(payload.report.boundedRequest.program).toBe(
      "enterprise-dispute-adjudication-v1",
    );
  });
});
