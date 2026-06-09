import type { Rule, AuditIssue } from "../../types.js";

/**
 * A bank deposit recorded in Xero but never reconciled against the bank feed.
 * Unreconciled deposits are where errors hide — they keep the bank balance from
 * matching the books and are the merchant's clearest "something is off" signal.
 */
export const unreconciledDeposit: Rule = (ctx): AuditIssue[] =>
  ctx.xeroTx
    .filter((tx) => !tx.reconciled)
    .map((tx) => ({
      ruleId: "unreconciled-deposit",
      severity: "medium",
      title: "Unreconciled bank deposit in Xero",
      detail: `Xero transaction ${tx.reference ?? tx.id} (${tx.amount} ${tx.currency} on ${tx.date}) is not reconciled against the bank feed.`,
      xeroRef: tx.reference ?? tx.id,
      impact: { amount: tx.amount, currency: tx.currency },
    }));
