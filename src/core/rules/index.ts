import type { Rule } from "../../types.js";
import { missingInXero } from "./missingInXero.js";
import { duplicateInXero } from "./duplicateInXero.js";
import { amountMismatch } from "./amountMismatch.js";
import { fxDiscrepancy } from "./fxDiscrepancy.js";
import { unreconciledDeposit } from "./unreconciledDeposit.js";

/**
 * The ordered set of audit rules. Add new checks here (e.g. tax-code mapping,
 * rounding drift, refund handling) and they are automatically included.
 */
export const rules: Rule[] = [
  missingInXero,
  duplicateInXero,
  amountMismatch,
  fxDiscrepancy,
  unreconciledDeposit,
];
