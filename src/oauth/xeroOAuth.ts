import type { AppConfig } from "../config.js";

const AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Build the Xero OAuth 2.0 authorization URL. */
export function buildXeroAuthUrl(config: AppConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.xero.clientId,
    redirect_uri: config.xero.redirectUri,
    scope: config.xero.scopes,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuth(config: AppConfig): string {
  return Buffer.from(`${config.xero.clientId}:${config.xero.clientSecret}`).toString("base64");
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeXeroCode(
  config: AppConfig,
  code: string,
): Promise<XeroTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.xero.redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Xero token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as XeroTokenResponse;
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshXeroToken(
  config: AppConfig,
  refreshToken: string,
): Promise<XeroTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Xero token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as XeroTokenResponse;
}

/** Resolve the first connected organisation's tenant id (needed on every API call). */
export async function fetchXeroTenantId(accessToken: string): Promise<string> {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Xero connections lookup failed: ${res.status} ${await res.text()}`);
  }
  const conns = (await res.json()) as Array<{ tenantId: string }>;
  const first = conns[0];
  if (!first) throw new Error("No Xero organisation is connected to this login.");
  return first.tenantId;
}
