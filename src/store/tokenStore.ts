import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Minimal persistent token store (JSON file) for local development.
 *
 * SECURITY: tokens are stored unencrypted on disk here for skeleton simplicity.
 * Before production, swap this for an encrypted secret store or a database with
 * per-shop encryption keys.
 */
export interface ShopifyToken {
  shop: string;
  accessToken: string;
}

export interface XeroToken {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  /** epoch ms when the access token expires. */
  expiresAt: number;
}

interface StoreShape {
  shopify: Record<string, ShopifyToken>;
  xero?: XeroToken;
}

const FILE = ".data/tokens.json";

async function readStore(): Promise<StoreShape> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as StoreShape;
  } catch {
    return { shopify: {} };
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function saveShopifyToken(token: ShopifyToken): Promise<void> {
  const store = await readStore();
  store.shopify[token.shop] = token;
  await writeStore(store);
}

export async function getShopifyToken(shop: string): Promise<ShopifyToken | undefined> {
  const store = await readStore();
  return store.shopify[shop];
}

/** Remove a shop's stored token (app/uninstalled, shop/redact). */
export async function deleteShopifyToken(shop: string): Promise<void> {
  const store = await readStore();
  delete store.shopify[shop];
  await writeStore(store);
}

/** Convenience for the single-tenant dev dashboard: first connected shop. */
export async function getAnyShopifyToken(): Promise<ShopifyToken | undefined> {
  const store = await readStore();
  const firstKey = Object.keys(store.shopify)[0];
  return firstKey ? store.shopify[firstKey] : undefined;
}

export async function saveXeroToken(token: XeroToken): Promise<void> {
  const store = await readStore();
  store.xero = token;
  await writeStore(store);
}

export async function getXeroToken(): Promise<XeroToken | undefined> {
  const store = await readStore();
  return store.xero;
}
