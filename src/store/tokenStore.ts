import type { ShopifyToken, TokenBackend, XeroToken } from "./backend.js";
import { FileTokenBackend } from "./fileBackend.js";

// Re-export the token types so existing imports from "./store/tokenStore.js" keep working.
export type { ShopifyToken, XeroToken } from "./backend.js";

/**
 * Select the storage backend once, at first use:
 *  - `DATABASE_URL` present  -> Postgres (production; survives restarts).
 *  - otherwise               -> local JSON file (development).
 *
 * The Postgres backend is imported lazily so local dev never needs `pg` to
 * connect (or a database to be running).
 */
let backendPromise: Promise<TokenBackend> | undefined;

function getBackend(): Promise<TokenBackend> {
  if (!backendPromise) {
    const url = process.env.DATABASE_URL;
    backendPromise = url
      ? import("./pgBackend.js").then((m) => new m.PgTokenBackend(url))
      : Promise.resolve(new FileTokenBackend());
  }
  return backendPromise;
}

export async function saveShopifyToken(token: ShopifyToken): Promise<void> {
  return (await getBackend()).saveShopifyToken(token);
}

export async function getShopifyToken(shop: string): Promise<ShopifyToken | undefined> {
  return (await getBackend()).getShopifyToken(shop);
}

/** Remove a shop's stored token (app/uninstalled, shop/redact). */
export async function deleteShopifyToken(shop: string): Promise<void> {
  return (await getBackend()).deleteShopifyToken(shop);
}

/** Convenience for the single-tenant dev dashboard: first connected shop. */
export async function getAnyShopifyToken(): Promise<ShopifyToken | undefined> {
  return (await getBackend()).getAnyShopifyToken();
}

export async function saveXeroToken(token: XeroToken): Promise<void> {
  return (await getBackend()).saveXeroToken(token);
}

export async function getXeroToken(): Promise<XeroToken | undefined> {
  return (await getBackend()).getXeroToken();
}
