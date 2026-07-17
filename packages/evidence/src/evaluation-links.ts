import type {
  EvidenceLink,
  EvidenceItem,
  ReviewReport,
} from "@genforge/domain";

export function buildEvidenceLinksFromReviewReport(
  report: ReviewReport,
): EvidenceLink[] {
  const validEvidenceIds = new Set(report.evidence.map((item) => item.id));
  const links: EvidenceLink[] = [];

  for (const finding of report.findings) {
    for (const evidenceId of finding.evidenceIds) {
      if (validEvidenceIds.has(evidenceId)) {
        links.push({
          evidenceId,
          supports: "finding",
          targetId: finding.id,
          strength: "direct",
        });
        links.push({
          evidenceId,
          supports: "rule",
          targetId: finding.ruleId,
          strength: "direct",
        });
      }
    }
  }

  return links;
}

export function findEvidenceItemsByIds(
  evidence: EvidenceItem[],
  evidenceIds: string[],
): EvidenceItem[] {
  const wanted = new Set(evidenceIds);
  return evidence.filter((item) => wanted.has(item.id));
}
