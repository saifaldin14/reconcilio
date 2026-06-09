import { runAudit } from "./core/auditEngine.js";
import { samplePayouts } from "./sampleData/shopify.sample.js";
import { sampleXeroTx } from "./sampleData/xero.sample.js";
import type { AuditResult, Severity } from "./types.js";

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "HIGH  ",
  medium: "MEDIUM",
  low: "LOW   ",
};

function scoreBadge(score: number): string {
  if (score >= 90) return `${score}/100  ✅ Healthy`;
  if (score >= 60) return `${score}/100  ⚠️  Needs attention`;
  return `${score}/100  ❌ At risk`;
}

function printReport(result: AuditResult): void {
  const { issues, healthScore, summary } = result;

  console.log("\n=== Reconcilio — Books Health Report ===\n");
  console.log(`Books Health Score:  ${scoreBadge(healthScore)}`);
  console.log(
    `Payouts checked:     ${summary.checkedPayouts}   ` +
      `Issues: ${summary.high} high · ${summary.medium} medium · ${summary.low} low\n`,
  );

  if (issues.length === 0) {
    console.log("No discrepancies found. Books look reconciled. 🎉\n");
    return;
  }

  issues.forEach((issue, i) => {
    const impact = issue.impact
      ? `  (≈ ${issue.impact.amount} ${issue.impact.currency})`
      : "";
    console.log(`${i + 1}. [${SEVERITY_LABEL[issue.severity]}] ${issue.title}${impact}`);
    console.log(`   ${issue.detail}`);
    const refs = [
      issue.shopifyRef ? `shopify:${issue.shopifyRef}` : null,
      issue.xeroRef ? `xero:${issue.xeroRef}` : null,
    ]
      .filter(Boolean)
      .join("  ");
    if (refs) console.log(`   ↳ ${refs}`);
    console.log("");
  });
}

printReport(runAudit(samplePayouts, sampleXeroTx));
