import type { ShopifyPayout } from "../types.js";

/**
 * Sample Shopify payouts used by the demo and tests. Each row is crafted to
 * exercise one audit rule:
 *  - P1  clean (matches a Xero line exactly)            -> no issue (but has a duplicate in Xero)
 *  - P2  no matching Xero transaction                   -> missing-in-xero
 *  - P3  Xero recorded gross, fees unbooked             -> fees-not-recorded
 *  - P4  multi-currency sale, FX not applied            -> fx-discrepancy
 */
export const samplePayouts: ShopifyPayout[] = [
  { id: "P1", date: "2026-05-01", gross: 1000, fees: 30, net: 970, currency: "GBP" },
  { id: "P2", date: "2026-05-03", gross: 500, fees: 15, net: 485, currency: "GBP" },
  { id: "P3", date: "2026-05-05", gross: 800, fees: 24, net: 776, currency: "GBP" },
  {
    id: "P4",
    date: "2026-05-07",
    gross: 420,
    fees: 20,
    net: 400,
    currency: "GBP",
    presentmentCurrency: "USD",
  },
];
