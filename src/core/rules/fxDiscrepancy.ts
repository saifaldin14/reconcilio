import type { Rule, AuditIssue } from "../../types.js";
import { round2 } from "../utils.js";

/**
 * Multi-currency payouts are the incumbents' best-known weak spot. When a sale
 * is made in a presentment currency different from the settlement currency, the
 * Xero amount must equal the settled net in the settlement currency, with any
 * FX gain/loss booked. A mismatch (or wrong currency) means the conversion was
 * not handled — a common source of misstated revenue on cross-border stores.
 */
export const fxDiscrepancy: Rule = (ctx): AuditIssue[] => {
  const issues: AuditIssue[] = [];

  for (const pair of ctx.pairs) {
    const { payout, xero } = pair;
    if (!xero) continue;
    if (!payout.presentmentCurrency || payout.presentmentCurrency === payout.currency) {
      continue;
    }

    const delta = round2(xero.amount - payout.net);
    const wrongCurrency = xero.currency !== payout.currency;

    if (wrongCurrency || Math.abs(delta) > ctx.options.amountTolerance) {
      issues.push({
        ruleId: "fx-discrepancy",
        severity: "high",
        title: "Multi-currency payout not converted correctly",
        detail: `Payout ${payout.id} was presented in ${payout.presentmentCurrency} and settled as ${payout.net} ${payout.currency}, but Xero shows ${xero.amount} ${xero.currency}. FX gain/loss appears unhandled.`,
        shopifyRef: payout.id,
        xeroRef: xero.reference ?? xero.id,
        impact: { amount: Math.abs(delta), currency: payout.currency },
      });
    }
  }

  return issues;
};
