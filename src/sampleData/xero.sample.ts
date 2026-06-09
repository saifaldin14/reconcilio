import type { XeroBankTransaction } from "../types.js";

/**
 * Sample Xero bank transactions used by the demo and tests.
 *  - X1 + X1b  same payout recorded twice              -> duplicate-in-xero
 *  - (P2 has no row here)                               -> missing-in-xero
 *  - X3  recorded gross 800 instead of net 776          -> fees-not-recorded
 *  - X4  multi-currency net not converted               -> fx-discrepancy
 *  - X5  deposit left unreconciled                      -> unreconciled-deposit
 */
export const sampleXeroTx: XeroBankTransaction[] = [
  { id: "X1", date: "2026-05-01", amount: 970, currency: "GBP", reference: "P1", reconciled: true },
  { id: "X1b", date: "2026-05-01", amount: 970, currency: "GBP", reference: "P1", reconciled: true },
  { id: "X3", date: "2026-05-05", amount: 800, currency: "GBP", reference: "P3", reconciled: true },
  { id: "X4", date: "2026-05-07", amount: 500, currency: "GBP", reference: "P4", reconciled: true },
  { id: "X5", date: "2026-05-09", amount: 250, currency: "GBP", reconciled: false },
];
