import express from "express";
import crypto from "node:crypto";
import { loadConfig, describeMissing } from "./config.js";
import { runAudit } from "./core/auditEngine.js";
import type { FixAction } from "./types.js";
import { ShopifyClient } from "./adapters/shopify/shopifyClient.js";
import { XeroClient } from "./adapters/xero/xeroClient.js";
import {
  buildInstallUrl,
  verifyShopifyHmac,
  isValidShop,
  exchangeShopifyCode,
} from "./oauth/shopifyOAuth.js";
import {
  buildXeroAuthUrl,
  exchangeXeroCode,
  refreshXeroToken,
  fetchXeroTenantId,
} from "./oauth/xeroOAuth.js";
import {
  saveShopifyToken,
  getAnyShopifyToken,
  saveXeroToken,
  getXeroToken,
  type XeroToken,
} from "./store/tokenStore.js";
import { renderConnect, renderReport, layout } from "./web/report.js";
import {
  renderPaywall,
  renderFixConfirm,
  renderFixResult,
  configureEmbedding,
} from "./web/report.js";
import {
  PLANS,
  createSubscription,
  getActiveSubscription,
} from "./billing/shopifyBilling.js";
import { verifyWebhookHmac } from "./webhooks/verify.js";
import { handleWebhook } from "./webhooks/handlers.js";

// --- Configuration gate: ask the user for any missing values, then stop. ---
const { config, missing } = loadConfig();
if (!config) {
  console.log("\n=== Reconcilio — ACTION REQUIRED ===\n");
  console.log(describeMissing(missing));
  process.exit(0);
}
const cfg = config;

const app = express();

// Embedding inside the Shopify admin (App Bridge) + CSP + form body parsing.
configureEmbedding(cfg.shopify.apiKey);
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const shop = String(req.query.shop ?? "");
  const ancestors = isValidShop(shop)
    ? `https://${shop} https://admin.shopify.com`
    : "https://admin.shopify.com";
  res.setHeader("Content-Security-Policy", `frame-ancestors ${ancestors};`);
  next();
});

// OAuth CSRF state (in-memory; fine for a single-process dev server).
const states = new Set<string>();
function newState(): string {
  const s = crypto.randomBytes(16).toString("hex");
  states.add(s);
  return s;
}

const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const auditWindow = (): { since: string; until: string } => ({
  since: ymd(new Date(Date.now() - 60 * 864e5)),
  until: ymd(new Date()),
});

/** Return a valid Xero token, transparently refreshing if it has expired. */
async function freshXero(): Promise<XeroToken | undefined> {
  const tok = await getXeroToken();
  if (!tok) return undefined;
  if (Date.now() <= tok.expiresAt - 60_000) return tok;

  const r = await refreshXeroToken(cfg, tok.refreshToken);
  const updated: XeroToken = {
    ...tok,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Date.now() + r.expires_in * 1000,
  };
  await saveXeroToken(updated);
  return updated;
}

type OpenGate = { ok: true; shop: string; accessToken: string; xero: XeroToken };

/**
 * Single gate for protected routes: requires Shopify + Xero connected AND an
 * active subscription. Returns either the ready context or HTML to render
 * (connect screen or paywall).
 */
async function gateState(): Promise<OpenGate | { ok: false; render: string }> {
  const shopify = await getAnyShopifyToken();
  const xero = await getXeroToken();
  if (!shopify || !xero) {
    return {
      ok: false,
      render: renderConnect({
        shopifyConnected: !!shopify,
        xeroConnected: !!xero,
        shop: shopify?.shop,
      }),
    };
  }
  const x = await freshXero();
  if (!x) {
    return { ok: false, render: renderConnect({ shopifyConnected: true, xeroConnected: false }) };
  }
  try {
    const sub = await getActiveSubscription(cfg, shopify.shop, shopify.accessToken);
    if (!sub.active) return { ok: false, render: renderPaywall(PLANS) };
  } catch (err) {
    return {
      ok: false,
      render: renderPaywall(PLANS, {
        note: `Could not verify subscription: ${(err as Error).message}`,
      }),
    };
  }
  return { ok: true, shop: shopify.shop, accessToken: shopify.accessToken, xero: x };
}

/** Run a live audit for an open gate (reads only). */
async function loadAudit(gate: OpenGate) {
  const { since, until } = auditWindow();
  const payouts = await new ShopifyClient(cfg, gate.shop, gate.accessToken).fetchPayouts(
    since,
    until,
  );
  const tx = await new XeroClient(gate.xero.accessToken, gate.xero.tenantId).fetchBankTransactions(
    since,
    until,
  );
  return runAudit(payouts, tx);
}

/** Apply a single fix, honouring the ALLOW_XERO_WRITES safety switch. */
async function applyFix(fix: FixAction, xero: XeroToken): Promise<string> {
  const client = new XeroClient(xero.accessToken, xero.tenantId);

  if (fix.type === "delete-duplicate") {
    if (!cfg.allowWrites) {
      return `Preview: would delete duplicate Xero transaction ${fix.xeroTransactionId}. Set ALLOW_XERO_WRITES=true to apply.`;
    }
    await client.deleteBankTransaction(fix.xeroTransactionId);
    return `Deleted duplicate Xero transaction ${fix.xeroTransactionId}.`;
  }

  // create-missing
  if (!cfg.xero.bankAccountCode || !cfg.xero.salesAccountCode) {
    return (
      "Cannot create the transaction yet — I need two values from you. Add these to .env:\n" +
      "  • XERO_BANK_ACCOUNT_CODE — the Xero bank account your Shopify payouts settle into\n" +
      "  • XERO_SALES_ACCOUNT_CODE — the Xero revenue account to post sales to"
    );
  }
  if (!cfg.allowWrites) {
    return `Preview: would create a ${fix.amount} ${fix.currency} receive-money transaction (ref ${fix.reference}). Set ALLOW_XERO_WRITES=true to apply.`;
  }
  const id = await client.createBankTransaction({
    date: fix.date,
    amount: fix.amount,
    currency: fix.currency,
    reference: fix.reference,
    contactName: cfg.xero.contactName,
    bankAccountCode: cfg.xero.bankAccountCode,
    salesAccountCode: cfg.xero.salesAccountCode,
  });
  return `Created Xero transaction ${id} for payout ${fix.reference}.`;
}

// --- Dashboard ---
app.get("/", async (_req, res) => {
  const gate = await gateState();
  if (!gate.ok) {
    res.send(gate.render);
    return;
  }
  try {
    res.send(renderReport(await loadAudit(gate), { shop: gate.shop }));
  } catch (err) {
    res
      .status(500)
      .send(
        layout(
          "Error",
          `<h1>Could not run audit</h1><pre>${(err as Error).message}</pre><p><a href="/">Back</a></p>`,
        ),
      );
  }
});

// --- Shopify OAuth ---
app.get("/auth/shopify", (req, res) => {
  const shop = String(req.query.shop ?? "");
  if (!isValidShop(shop)) {
    res.status(400).send("Invalid shop domain. Use the form: your-store.myshopify.com");
    return;
  }
  res.redirect(buildInstallUrl(cfg, shop, newState()));
});

app.get("/auth/shopify/callback", async (req, res) => {
  const q = Object.fromEntries(
    Object.entries(req.query).map(([k, v]) => [k, String(v)]),
  ) as Record<string, string>;

  if (!q.state || !states.delete(q.state)) {
    res.status(400).send("Invalid OAuth state.");
    return;
  }
  if (!verifyShopifyHmac(q, cfg.shopify.apiSecret)) {
    res.status(400).send("HMAC validation failed.");
    return;
  }
  const shop = q.shop ?? "";
  if (!isValidShop(shop)) {
    res.status(400).send("Invalid shop.");
    return;
  }
  try {
    const accessToken = await exchangeShopifyCode(cfg, shop, q.code ?? "");
    await saveShopifyToken({ shop, accessToken });
    res.redirect("/");
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

// --- Xero OAuth ---
app.get("/auth/xero", (_req, res) => {
  res.redirect(buildXeroAuthUrl(cfg, newState()));
});

app.get("/auth/xero/callback", async (req, res) => {
  const state = String(req.query.state ?? "");
  if (!states.delete(state)) {
    res.status(400).send("Invalid OAuth state.");
    return;
  }
  try {
    const tokens = await exchangeXeroCode(cfg, String(req.query.code ?? ""));
    const tenantId = await fetchXeroTenantId(tokens.access_token);
    await saveXeroToken({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tenantId,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
    res.redirect("/");
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

// --- Audit as JSON (for integrations / debugging) ---
app.get("/audit.json", async (_req, res) => {
  const gate = await gateState();
  if (!gate.ok) {
    res.status(402).json({ error: "Connect both accounts and subscribe first." });
    return;
  }
  try {
    res.json(await loadAudit(gate));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- One-click fixes (write corrections back to Xero) ---
app.get("/fix", async (req, res) => {
  const gate = await gateState();
  if (!gate.ok) {
    res.send(gate.render);
    return;
  }
  const index = Number(req.query.index ?? -1);
  try {
    const issue = (await loadAudit(gate)).issues[index];
    if (!issue?.fix) {
      res
        .status(404)
        .send(layout("Not found", `<h1>No fixable issue at that position.</h1><a href="/">Back</a>`));
      return;
    }
    res.send(renderFixConfirm(issue.fix.label, index, { allowWrites: cfg.allowWrites }));
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

app.post("/fix", async (req, res) => {
  const gate = await gateState();
  if (!gate.ok) {
    res.send(gate.render);
    return;
  }
  const index = Number(req.body?.index ?? -1);
  try {
    const issue = (await loadAudit(gate)).issues[index];
    if (!issue?.fix) {
      res.status(404).send(renderFixResult("That issue is no longer present.", false));
      return;
    }
    res.send(renderFixResult(await applyFix(issue.fix, gate.xero), true));
  } catch (err) {
    res.send(renderFixResult((err as Error).message, false));
  }
});

// --- Billing (Shopify recurring charge) ---
app.get("/billing/subscribe", async (req, res) => {
  const plan = PLANS.find((p) => p.id === String(req.query.plan ?? "growth"));
  const shopify = await getAnyShopifyToken();
  if (!plan) {
    res.status(400).send("Unknown plan.");
    return;
  }
  if (!shopify) {
    res.status(409).send("Connect Shopify first.");
    return;
  }
  try {
    const { confirmationUrl } = await createSubscription(cfg, shopify.shop, shopify.accessToken, plan);
    res.redirect(confirmationUrl);
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

app.get("/billing/return", (_req, res) => {
  res.send(
    layout(
      "Subscribed",
      `<h1>Thanks!</h1><p>Your subscription is active. <a href="/">Back to dashboard</a></p>`,
    ),
  );
});

// --- Production webhooks (HMAC-verified; declared in shopify.app.toml) ---
app.post("/webhooks", express.raw({ type: "*/*" }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyWebhookHmac(raw, req.get("X-Shopify-Hmac-Sha256"), cfg.shopify.apiSecret)) {
    res.status(401).send("Invalid webhook HMAC");
    return;
  }
  const topic = req.get("X-Shopify-Topic") ?? "";
  const shop = req.get("X-Shopify-Shop-Domain") ?? "";
  let payload: unknown;
  try {
    payload = raw.length ? JSON.parse(raw.toString("utf8")) : undefined;
  } catch {
    payload = undefined;
  }
  try {
    await handleWebhook({ topic, shop, payload });
    res.status(200).send("ok");
  } catch (err) {
    console.error(`[webhook] error handling ${topic}:`, (err as Error).message);
    res.status(500).send("error");
  }
});

app.listen(cfg.port, () => {
  console.log(`Reconcilio running at ${cfg.appUrl} (port ${cfg.port})`);
});
