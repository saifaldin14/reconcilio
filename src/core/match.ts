import type {
  MatchPair,
  ShopifyPayout,
  XeroBankTransaction,
  AuditOptions,
} from "../types.js";
import { daysBetween } from "./utils.js";

/**
 * Match Shopify payouts to Xero bank transactions.
 *
 * Strategy: prefer an explicit reference match (`xero.reference === payout.id`);
 * fall back to a fuzzy match on same currency + near amount + near date. Each
 * Xero transaction is consumed at most once so duplicates remain detectable.
 */
export function matchPayouts(
  payouts: ShopifyPayout[],
  xeroTx: XeroBankTransaction[],
  options: AuditOptions,
): MatchPair[] {
  const used = new Set<string>();

  return payouts.map((payout) => {
    // 1) Exact reference match.
    let candidate = xeroTx.find(
      (tx) => !used.has(tx.id) && tx.reference === payout.id,
    );

    // 2) Fuzzy match on currency + amount + date.
    if (!candidate) {
      candidate = xeroTx.find(
        (tx) =>
          !used.has(tx.id) &&
          tx.currency === payout.currency &&
          Math.abs(tx.amount - payout.net) <= options.amountTolerance &&
          daysBetween(tx.date, payout.date) <= options.dateToleranceDays,
      );
    }

    if (candidate) used.add(candidate.id);
    return { payout, xero: candidate };
  });
}
