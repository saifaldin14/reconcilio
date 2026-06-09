import { describe, it, expect } from "vitest";
import { normalizeShop, isValidShop } from "../src/oauth/shopifyOAuth.js";

describe("normalizeShop", () => {
  const expected = "teststore-10010101001011420.myshopify.com";

  it("accepts a bare domain unchanged", () => {
    expect(normalizeShop(expected)).toBe(expected);
  });

  it("strips https:// prefix", () => {
    expect(normalizeShop(`https://${expected}`)).toBe(expected);
  });

  it("strips http:// and trailing path", () => {
    expect(normalizeShop(`http://${expected}/admin`)).toBe(expected);
  });

  it("strips www., trailing slash, and whitespace, and lowercases", () => {
    expect(normalizeShop(`  https://WWW.${expected.toUpperCase()}/  `)).toBe(expected);
  });

  it("normalized value passes isValidShop", () => {
    expect(isValidShop(normalizeShop(`https://${expected}/admin/orders`))).toBe(true);
  });

  it("rejects a non-myshopify domain after normalization", () => {
    expect(isValidShop(normalizeShop("https://evil.com/teststore.myshopify.com"))).toBe(false);
  });
});
