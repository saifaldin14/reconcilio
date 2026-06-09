import crypto from "node:crypto";
import type { AppConfig } from "../config.js";

/** Build the Shopify OAuth install/authorize URL. */
export function buildInstallUrl(config: AppConfig, shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.shopify.apiKey,
    scope: config.shopify.scopes,
    redirect_uri: `${config.appUrl}/auth/shopify/callback`,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify the HMAC Shopify appends to OAuth callbacks: HMAC-SHA256 over the
 * sorted query string (excluding `hmac`/`signature`) keyed by the API secret.
 */
export function verifyShopifyHmac(
  query: Record<string, string>,
  apiSecret: string,
): boolean {
  const { hmac, signature: _signature, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

const SHOP_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

/** Guard against open-redirect / spoofed shop domains. */
export function isValidShop(shop: string): boolean {
  return SHOP_REGEX.test(shop);
}

/** Exchange an authorization code for a permanent Admin API access token. */
export async function exchangeShopifyCode(
  config: AppConfig,
  shop: string,
  code: string,
): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.shopify.apiKey,
      client_secret: config.shopify.apiSecret,
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
