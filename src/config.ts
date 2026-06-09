import "dotenv/config";

/**
 * Central configuration loader.
 *
 * This is where "ask the user for any value I don't have" is enforced: required
 * secrets have no defaults, and if any are missing the app refuses to start and
 * prints exactly what to add (see `describeMissing`). Non-secret values have
 * sensible defaults and can be overridden in `.env`.
 */
export interface AppConfig {
  port: number;
  appUrl: string;
  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string;
    apiVersion: string;
  };
  xero: {
    clientId: string;
    clientSecret: string;
    scopes: string;
    redirectUri: string;
    /** Xero bank account code Shopify payouts settle into (for create fixes). */
    bankAccountCode?: string;
    /** Xero revenue account code used on created transactions (for create fixes). */
    salesAccountCode?: string;
    /** Contact name used on transactions created by a fix. */
    contactName: string;
  };
  /** Master safety switch: when false, fixes run as a preview and never write. */
  allowWrites: boolean;
}

export interface MissingVar {
  name: string;
  hint: string;
}

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** Required secrets — no defaults on purpose. */
const REQUIRED: MissingVar[] = [
  { name: "SHOPIFY_API_KEY", hint: "Shopify Partners → your app → Client credentials → Client ID (formerly 'API key')" },
  { name: "SHOPIFY_API_SECRET", hint: "Shopify Partners → your app → Client credentials → Client secret (formerly 'API secret key')" },
  { name: "XERO_CLIENT_ID", hint: "Xero Developer → My Apps → your app → Client id" },
  { name: "XERO_CLIENT_SECRET", hint: "Xero Developer → My Apps → your app → generate a Client secret" },
];

export function loadConfig(): { config?: AppConfig; missing: MissingVar[] } {
  const missing = REQUIRED.filter((r) => !read(r.name));
  if (missing.length > 0) return { missing };

  // Prefer an explicit APP_URL; otherwise use the URL Render injects at runtime
  // (RENDER_EXTERNAL_URL) so deploys work with zero manual URL editing; finally
  // fall back to localhost for local dev.
  const appUrl = read("APP_URL") ?? read("RENDER_EXTERNAL_URL") ?? "http://localhost:3000";
  const config: AppConfig = {
    port: Number(read("PORT") ?? "3000"),
    appUrl,
    shopify: {
      apiKey: read("SHOPIFY_API_KEY")!,
      apiSecret: read("SHOPIFY_API_SECRET")!,
      scopes: read("SHOPIFY_SCOPES") ?? "read_orders,read_shopify_payments_payouts",
      apiVersion: read("SHOPIFY_API_VERSION") ?? "2026-04",
    },
    xero: {
      clientId: read("XERO_CLIENT_ID")!,
      clientSecret: read("XERO_CLIENT_SECRET")!,
      scopes:
        read("XERO_SCOPES") ??
        "offline_access accounting.transactions accounting.settings.read",
      redirectUri: read("XERO_REDIRECT_URI") ?? `${appUrl}/auth/xero/callback`,
      bankAccountCode: read("XERO_BANK_ACCOUNT_CODE"),
      salesAccountCode: read("XERO_SALES_ACCOUNT_CODE"),
      contactName: read("XERO_CONTACT_NAME") ?? "Shopify",
    },
    allowWrites: (read("ALLOW_XERO_WRITES") ?? "false").toLowerCase() === "true",
  };
  return { config, missing: [] };
}

export function describeMissing(missing: MissingVar[]): string {
  const lines = missing.map((m) => `  • ${m.name} — ${m.hint}`);
  return [
    "Missing required configuration. Please add these values to your .env file:",
    "",
    ...lines,
    "",
    "Steps: copy .env.example to .env, paste in the values above, then run again.",
    "(Secrets belong in .env only — never commit them.)",
  ].join("\n");
}
