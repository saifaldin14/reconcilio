/**
 * Token storage abstraction.
 *
 * Two backends implement this interface:
 *  - file backend (local dev): JSON on disk.
 *  - Postgres backend (production): survives restarts/redeploys on hosts with
 *    ephemeral filesystems (e.g. Render free tier).
 *
 * The active backend is chosen at startup by the presence of `DATABASE_URL`.
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

export interface TokenBackend {
  saveShopifyToken(token: ShopifyToken): Promise<void>;
  getShopifyToken(shop: string): Promise<ShopifyToken | undefined>;
  deleteShopifyToken(shop: string): Promise<void>;
  /** Convenience for the single-tenant dashboard: first connected shop. */
  getAnyShopifyToken(): Promise<ShopifyToken | undefined>;
  saveXeroToken(token: XeroToken): Promise<void>;
  getXeroToken(): Promise<XeroToken | undefined>;
}
