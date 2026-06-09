import { Pool } from "pg";
import type { ShopifyToken, TokenBackend, XeroToken } from "./backend.js";

/**
 * Postgres-backed token store for production.
 *
 * Works with any Postgres connection string (Render, Neon, Supabase, etc.).
 * Tables are created lazily on first use. The Xero token is a single-tenant
 * singleton in this build, stored under a fixed key.
 *
 * SECURITY NOTE: tokens are stored as plaintext columns here. For a real launch,
 * encrypt them at rest (e.g. pgcrypto or app-level encryption with a KMS key).
 */
const XERO_SINGLETON = "default";

function isLocal(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/**
 * Strip the `sslmode` query param so it doesn't drive pg's SSL behavior, and
 * decide SSL explicitly instead. This avoids the pg/libpq `sslmode` semantics
 * change warning and keeps managed providers (Neon, Supabase, Render) working,
 * where the CA isn't in the local trust store.
 */
function buildPoolConfig(connectionString: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean };
} {
  if (isLocal(connectionString)) {
    return { connectionString, ssl: false };
  }
  const cleaned = connectionString.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre: string, post: string) =>
    post === "&" ? pre : "",
  );
  return { connectionString: cleaned, ssl: { rejectUnauthorized: false } };
}

export class PgTokenBackend implements TokenBackend {
  private readonly pool: Pool;
  private ready?: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool(buildPoolConfig(connectionString));
  }

  /** Create tables once, lazily, before the first query. */
  private ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool
        .query(
          `CREATE TABLE IF NOT EXISTS shopify_tokens (
             shop TEXT PRIMARY KEY,
             access_token TEXT NOT NULL
           );
           CREATE TABLE IF NOT EXISTS xero_tokens (
             id TEXT PRIMARY KEY,
             access_token TEXT NOT NULL,
             refresh_token TEXT NOT NULL,
             tenant_id TEXT NOT NULL,
             expires_at BIGINT NOT NULL
           );`,
        )
        .then(() => undefined);
    }
    return this.ready;
  }

  async saveShopifyToken(token: ShopifyToken): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO shopify_tokens (shop, access_token) VALUES ($1, $2)
       ON CONFLICT (shop) DO UPDATE SET access_token = EXCLUDED.access_token`,
      [token.shop, token.accessToken],
    );
  }

  async getShopifyToken(shop: string): Promise<ShopifyToken | undefined> {
    await this.ensureSchema();
    const r = await this.pool.query<{ shop: string; access_token: string }>(
      `SELECT shop, access_token FROM shopify_tokens WHERE shop = $1`,
      [shop],
    );
    const row = r.rows[0];
    return row ? { shop: row.shop, accessToken: row.access_token } : undefined;
  }

  async deleteShopifyToken(shop: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(`DELETE FROM shopify_tokens WHERE shop = $1`, [shop]);
  }

  async getAnyShopifyToken(): Promise<ShopifyToken | undefined> {
    await this.ensureSchema();
    const r = await this.pool.query<{ shop: string; access_token: string }>(
      `SELECT shop, access_token FROM shopify_tokens ORDER BY shop LIMIT 1`,
    );
    const row = r.rows[0];
    return row ? { shop: row.shop, accessToken: row.access_token } : undefined;
  }

  async saveXeroToken(token: XeroToken): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO xero_tokens (id, access_token, refresh_token, tenant_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         tenant_id = EXCLUDED.tenant_id,
         expires_at = EXCLUDED.expires_at`,
      [XERO_SINGLETON, token.accessToken, token.refreshToken, token.tenantId, token.expiresAt],
    );
  }

  async getXeroToken(): Promise<XeroToken | undefined> {
    await this.ensureSchema();
    const r = await this.pool.query<{
      access_token: string;
      refresh_token: string;
      tenant_id: string;
      expires_at: string;
    }>(
      `SELECT access_token, refresh_token, tenant_id, expires_at
       FROM xero_tokens WHERE id = $1`,
      [XERO_SINGLETON],
    );
    const row = r.rows[0];
    return row
      ? {
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          tenantId: row.tenant_id,
          // BIGINT comes back as a string from pg; coerce to number (epoch ms).
          expiresAt: Number(row.expires_at),
        }
      : undefined;
  }
}
