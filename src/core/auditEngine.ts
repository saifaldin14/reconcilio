import type {
  AuditContext,
  AuditIssue,
  AuditOptions,
  AuditResult,
  Severity,
  ShopifyPayout,
  XeroBankTransaction,
} from "../types.js";
import { DEFAULT_OPTIONS } from "../types.js";
import { matchPayouts } from "./match.js";
import { rules } from "./rules/index.js";

const SEVERITY_PENALTY: Record<Severity, number> = {
  high: 15,
  medium: 7,
  low: 3,
};

/**
 * Run every audit rule over the merchant's Shopify payouts and Xero
 * transactions and produce a Books Health Score (0–100) plus the list of issues.
 *
 * Pure and side-effect free: the same engine powers the CLI demo, tests, and
 * (later) the embedded Shopify admin UI.
 */
export function runAudit(
  payouts: ShopifyPayout[],
  xeroTx: XeroBankTransaction[],
  options: AuditOptions = DEFAULT_OPTIONS,
): AuditResult {
  const pairs = matchPayouts(payouts, xeroTx, options);
  const ctx: AuditContext = { payouts, xeroTx, pairs, options };

  const issues: AuditIssue[] = rules.flatMap((rule) => rule(ctx));

  const summary = {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    checkedPayouts: payouts.length,
  };

  const penalty = issues.reduce(
    (sum, issue) => sum + SEVERITY_PENALTY[issue.severity],
    0,
  );
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  return { issues, healthScore, summary };
}
