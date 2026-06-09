import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ShopifyToken, TokenBackend, XeroToken } from "./backend.js";

/**
 * File-based token backend for local development.
 *
 * SECURITY: tokens are stored unencrypted on disk. This is for local dev only;
 * production uses the Postgres backend. Consider per-shop encryption before any
 * real launch regardless of backend.
 */
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

export class FileTokenBackend implements TokenBackend {
  async saveShopifyToken(token: ShopifyToken): Promise<void> {
    const store = await readStore();
    store.shopify[token.shop] = token;
    await writeStore(store);
  }

  async getShopifyToken(shop: string): Promise<ShopifyToken | undefined> {
    const store = await readStore();
    return store.shopify[shop];
  }

  async deleteShopifyToken(shop: string): Promise<void> {
    const store = await readStore();
    delete store.shopify[shop];
    await writeStore(store);
  }

  async getAnyShopifyToken(): Promise<ShopifyToken | undefined> {
    const store = await readStore();
    const firstKey = Object.keys(store.shopify)[0];
    return firstKey ? store.shopify[firstKey] : undefined;
  }

  async saveXeroToken(token: XeroToken): Promise<void> {
    const store = await readStore();
    store.xero = token;
    await writeStore(store);
  }

  async getXeroToken(): Promise<XeroToken | undefined> {
    const store = await readStore();
    return store.xero;
  }
}
