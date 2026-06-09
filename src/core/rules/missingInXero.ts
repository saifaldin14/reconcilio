import type { Rule, AuditIssue } from "../../types.js";

/**
 * A Shopify payout left the bank but no matching transaction exists in Xero.
 * This understates revenue/cash and is the most common cause of an
 * unbalanced bank reconciliation.
 */
export const missingInXero: Rule = (ctx): AuditIssue[] =>
  ctx.pairs
    .filter((pair) => !pair.xero)
    .map((pair) => ({
      ruleId: "missing-in-xero",
      severity: "high",
      title: "Shopify payout missing in Xero",
      detail: `Payout ${pair.payout.id} (${pair.payout.net} ${pair.payout.currency} on ${pair.payout.date}) has no matching transaction in Xero.`,
      shopifyRef: pair.payout.id,
      impact: { amount: pair.payout.net, currency: pair.payout.currency },
      fix: {
        type: "create-missing",
        date: pair.payout.date,
        amount: pair.payout.net,
        currency: pair.payout.currency,
        reference: pair.payout.id,
        label: `Create a Xero receive-money transaction for payout ${pair.payout.id}`,
      },
    }));
