/**
 * Shared domain + audit types for Reconcilio.
 *
 * These are *normalized* models: the Shopify and Xero adapters convert raw API
 * payloads into these shapes so the audit engine stays platform-agnostic and
 * reusable across accounting targets (Xero today; QuickBooks/Zoho/Sage later).
 */

/** A payout Shopify deposits to the merchant's bank, net of fees. */
export interface ShopifyPayout {
  /** Stable id used as the cross-system reference. */
  id: string;
  /** Payout date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Gross sales total in the settlement currency. */
  gross: number;
  /** Processor/Shopify fees deducted. */
  fees: number;
  /** Amount actually deposited to the bank (`gross - fees`). */
  net: number;
  /** Settlement (bank) currency, e.g. `GBP`. */
  currency: string;
  /** Presentment currency when the sale was made in another currency. */
  presentmentCurrency?: string;
}

/** A bank transaction as recorded in Xero (what the books say happened). */
export interface XeroBankTransaction {
  id: string;
  /** Transaction date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Amount recorded in Xero. */
  amount: number;
  /** Currency recorded in Xero. */
  currency: string;
  /** Reference linking back to a Shopify payout id, when present. */
  reference?: string;
  /** Whether the line has been reconciled against the bank feed. */
  reconciled: boolean;
}

export type Severity = "high" | "medium" | "low";

export interface Money {
  amount: number;
  currency: string;
}

/** A one-click correction the app can write back to Xero. */
export type FixAction =
  | {
      type: "delete-duplicate";
      /** Xero BankTransaction id to delete (the extra copy). */
      xeroTransactionId: string;
      label: string;
    }
  | {
      type: "create-missing";
      /** Source Shopify payout used to create the missing Xero transaction. */
      date: string;
      amount: number;
      currency: string;
      reference: string;
      label: string;
    };

/** A single problem found in the books. */
export interface AuditIssue {
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  shopifyRef?: string;
  xeroRef?: string;
  /** Estimated financial impact of the discrepancy, when quantifiable. */
  impact?: Money;
  /** Optional one-click correction the app can apply back to Xero. */
  fix?: FixAction;
}

export interface AuditSummary {
  high: number;
  medium: number;
  low: number;
  /** Number of Shopify payouts examined. */
  checkedPayouts: number;
}

export interface AuditResult {
  issues: AuditIssue[];
  /** 0–100; 100 = clean books. */
  healthScore: number;
  summary: AuditSummary;
}

/** A Shopify payout paired with its best-matching Xero transaction (if any). */
export interface MatchPair {
  payout: ShopifyPayout;
  xero?: XeroBankTransaction;
}

export interface AuditOptions {
  /** Absolute currency tolerance when comparing amounts. */
  amountTolerance: number;
  /** Max day gap when matching a payout to a Xero transaction by amount/date. */
  dateToleranceDays: number;
}

export interface AuditContext {
  payouts: ShopifyPayout[];
  xeroTx: XeroBankTransaction[];
  pairs: MatchPair[];
  options: AuditOptions;
}

/** A rule inspects the context and returns any issues it finds. */
export type Rule = (ctx: AuditContext) => AuditIssue[];

export const DEFAULT_OPTIONS: AuditOptions = {
  amountTolerance: 0.5,
  dateToleranceDays: 3,
};
