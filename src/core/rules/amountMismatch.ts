import type { Rule, AuditIssue } from "../../types.js";
import { round2 } from "../utils.js";

/**
 * For matched payouts, compare the Xero amount against the Shopify net.
 *
 *  - If the gap equals the processor fees, Xero recorded the gross and the fees
 *    were never booked — this overstates revenue and inflates tax owed.
 *  - Otherwise it's a generic net mismatch worth a human review.
 *
 * Multi-currency payouts are skipped here; the FX rule owns those.
 */
export const amountMismatch: Rule = (ctx): AuditIssue[] => {
  const issues: AuditIssue[] = [];

  for (const pair of ctx.pairs) {
    if (!pair.xero) continue;
    const { payout, xero } = pair;

    // Multi-currency is handled by the FX rule.
    if (payout.presentmentCurrency && payout.presentmentCurrency !== payout.currency) {
      continue;
    }

    const delta = round2(xero.amount - payout.net);
    if (Math.abs(delta) <= ctx.options.amountTolerance) continue;

    if (payout.fees > 0 && Math.abs(delta - payout.fees) <= ctx.options.amountTolerance) {
      issues.push({
        ruleId: "fees-not-recorded",
        severity: "high",
        title: "Processor fees not recorded in Xero",
        detail: `Xero recorded ${xero.amount} ${xero.currency} for payout ${payout.id} but the bank deposit was ${payout.net} (gross ${payout.gross} − fees ${payout.fees}). The ${payout.fees} ${payout.currency} in fees appear unbooked, overstating revenue.`,
        shopifyRef: payout.id,
        xeroRef: xero.reference ?? xero.id,
        impact: { amount: payout.fees, currency: payout.currency },
      });
    } else {
      issues.push({
        ruleId: "amount-mismatch",
        severity: "medium",
        title: "Net amount mismatch",
        detail: `Payout ${payout.id} net is ${payout.net} ${payout.currency} but Xero shows ${xero.amount}. Difference of ${delta}.`,
        shopifyRef: payout.id,
        xeroRef: xero.reference ?? xero.id,
        impact: { amount: Math.abs(delta), currency: payout.currency },
      });
    }
  }

  return issues;
};
