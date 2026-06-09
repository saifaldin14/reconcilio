import { describe, it, expect } from "vitest";
import { runAudit } from "../src/core/auditEngine.js";
import { samplePayouts } from "../src/sampleData/shopify.sample.js";
import { sampleXeroTx } from "../src/sampleData/xero.sample.js";

describe("runAudit on sample data", () => {
  const result = runAudit(samplePayouts, sampleXeroTx);
  const ruleIds = result.issues.map((i) => i.ruleId);

  it("flags a Shopify payout missing in Xero (P2)", () => {
    const issue = result.issues.find((i) => i.ruleId === "missing-in-xero");
    expect(issue?.shopifyRef).toBe("P2");
  });

  it("flags a duplicate transaction in Xero (P1 recorded twice)", () => {
    expect(ruleIds).toContain("duplicate-in-xero");
  });

  it("flags unrecorded processor fees (P3 booked at gross)", () => {
    const issue = result.issues.find((i) => i.ruleId === "fees-not-recorded");
    expect(issue?.shopifyRef).toBe("P3");
    expect(issue?.impact?.amount).toBe(24);
  });

  it("flags a multi-currency FX discrepancy (P4)", () => {
    const issue = result.issues.find((i) => i.ruleId === "fx-discrepancy");
    expect(issue?.shopifyRef).toBe("P4");
  });

  it("flags an unreconciled bank deposit (X5)", () => {
    expect(ruleIds).toContain("unreconciled-deposit");
  });

  it("produces a health score below 100 but not negative", () => {
    expect(result.healthScore).toBeLessThan(100);
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
  });

  it("does not flag the clean payout (P1) for amount mismatch", () => {
    const mismatches = result.issues.filter(
      (i) => i.ruleId === "amount-mismatch" && i.shopifyRef === "P1",
    );
    expect(mismatches).toHaveLength(0);
  });
});
