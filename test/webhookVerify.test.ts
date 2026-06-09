import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookHmac } from "../src/webhooks/verify.js";

describe("verifyWebhookHmac", () => {
  const secret = "test_secret";
  const body = Buffer.from(JSON.stringify({ id: 123, topic: "app/uninstalled" }));
  const validHmac = crypto.createHmac("sha256", secret).update(body).digest("base64");

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookHmac(body, validHmac, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyWebhookHmac(Buffer.from("tampered"), validHmac, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyWebhookHmac(body, validHmac, "wrong_secret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookHmac(body, undefined, secret)).toBe(false);
  });
});
