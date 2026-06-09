import crypto from "node:crypto";

/**
 * Verify a Shopify *webhook* HMAC.
 *
 * Note this differs from the OAuth callback HMAC: webhooks sign the **raw
 * request body** (not the query string) and the digest is **base64** (not hex),
 * delivered in the `X-Shopify-Hmac-Sha256` header. Comparison is constant-time.
 */
export function verifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string | undefined,
  apiSecret: string,
): boolean {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", apiSecret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
