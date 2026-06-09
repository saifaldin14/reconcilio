import type { Rule, AuditIssue, XeroBankTransaction } from "../../types.js";

/**
 * The same transaction recorded twice in Xero — overstates revenue/cash and
 * is a frequent side effect of re-running a sync or overlapping integrations.
 * Detected independently of matching so a duplicate of a matched payout is
 * still surfaced.
 */
export const duplicateInXero: Rule = (ctx): AuditIssue[] => {
  const groups = new Map<string, XeroBankTransaction[]>();

  for (const tx of ctx.xeroTx) {
    const key = `${tx.reference ?? ""}|${tx.amount}|${tx.date}|${tx.currency}`;
    const group = groups.get(key);
    if (group) group.push(tx);
    else groups.set(key, [tx]);
  }

  const issues: AuditIssue[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const extra = group[1]!;
    issues.push({
      ruleId: "duplicate-in-xero",
      severity: "high",
      title: "Duplicate transaction in Xero",
      detail: `${group.length} identical transactions found in Xero (${first.amount} ${first.currency} on ${first.date}${first.reference ? `, ref ${first.reference}` : ""}). Overstates revenue/cash.`,
      xeroRef: first.reference ?? first.id,
      impact: { amount: first.amount * (group.length - 1), currency: first.currency },
      fix: {
        type: "delete-duplicate",
        xeroTransactionId: extra.id,
        label: `Delete the duplicate Xero transaction (${extra.amount} ${extra.currency} on ${extra.date})`,
      },
    });
  }
  return issues;
};
