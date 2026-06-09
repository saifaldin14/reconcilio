# Reconcilio

**Reconciliation & audit for Shopify ↔ Xero.** A companion app that catches missing
payouts, duplicates, unbooked fees, multi-currency (FX) errors, and unreconciled
deposits — then fixes them with one click.

> Store listing title: **Reconcilio — Reconciliation & Audit for Xero**

Instead of competing head-on with the saturated sync market (A2X, Webgility, Link My Books,
the official connector — 199+ apps), this app **sits on top of whatever sync the merchant
already uses** and continuously **audits the books for costly errors**: missing/duplicate
payouts, unrecorded processor fees, multi-currency (FX) discrepancies, and unreconciled
bank deposits. It produces a **Books Health Score** and a fix-it checklist.

> Positioning: every A2X / Webgility / official-connector user is a *prospect*, not a rival.
> Lower build scope (read-only analysis first), high trust, sticky, easy "$19–39/mo accounting-
> accuracy insurance" with obvious ROI.

## Why this exists (validated demand, 2026)

- **Xero ~4.2M+ subscribers**, strongest in AU/NZ/UK — the same regions where Shopify is dense.
- The Shopify↔Xero sync category is **saturated** (proof of paying demand): incumbents carry
  hundreds–thousands of reviews.
- Incumbents' documented weak spots — **multi-currency**, **product-cost mapping**, "blind spots
  in financial reporting", unclear **tax mapping** — are exactly what an audit layer catches.

## Architecture

```
src/
  types.ts                  Shared domain + audit types (normalized models)
  core/
    auditEngine.ts          Runs all rules, computes the Books Health Score
    match.ts                Matches Shopify payouts to Xero bank transactions
    utils.ts                Small helpers (rounding)
    rules/
      index.ts              Rule registry
      missingInXero.ts      Shopify payout with no matching Xero transaction
      duplicateInXero.ts    Same transaction recorded twice in Xero
      amountMismatch.ts     Net mismatch / processor fees not recorded
      fxDiscrepancy.ts      Multi-currency payout not converted (FX gain/loss missing)
      unreconciledDeposit.ts Bank deposit left unreconciled in Xero
  adapters/
    shopify/shopifyClient.ts  STUB: OAuth + fetch payouts -> normalized model
    xero/xeroClient.ts        STUB: OAuth + fetch bank transactions -> normalized model
  billing/shopifyBilling.ts   STUB: recurring charge via Shopify Billing API
  sampleData/                 Mock data so the engine runs today
  index.ts                    Demo runner (audits the sample data, prints a report)
test/
  auditEngine.test.ts         Verifies each rule fires on the sample data
```

The **audit engine is platform-agnostic** and reusable: the same core can later audit
Shopify↔QuickBooks, Zoho Books, Sage, etc. by adding adapters.

## Getting started

```bash
npm install
npm run dev     # runs the audit on SAMPLE data and prints a Books Health report
npm test        # verifies the rules
```

## Connecting real data (live server)

The live server wires both OAuth flows + the audit engine into one app with a
small dashboard.

```bash
cp .env.example .env   # then fill in the 4 required secrets (table below)
npm run serve          # starts the server at http://localhost:3000
```

Open the dashboard, connect **Shopify** and **Xero**, and it runs a live audit
over the last 60 days of payouts vs. Xero bank transactions.

### Configuration (values you must provide)

Add these to `.env` (never commit real values):

| Variable | Secret? | Where to get it |
|---|---|---|
| `SHOPIFY_API_KEY` | yes | Shopify Partners → your app → API credentials |
| `SHOPIFY_API_SECRET` | yes | Shopify Partners → your app → API credentials |
| `XERO_CLIENT_ID` | yes | Xero Developer → My Apps → your app |
| `XERO_CLIENT_SECRET` | yes | Xero Developer → My Apps → your app → generate a secret |
| `APP_URL` | no | Public URL (tunnel for Shopify); defaults to `http://localhost:3000` |

Register these redirect URIs in each provider's app settings:

- Shopify allowed redirection URL: `${APP_URL}/auth/shopify/callback`
- Xero redirect URI: `${APP_URL}/auth/xero/callback`

If any required secret is missing, the server prints exactly what to add and
exits — so you always know what input is needed.

> Security: tokens are stored unencrypted in `.data/tokens.json` for local dev
> only. Use an encrypted store / database before production.

## Now included

- **Live adapters** — `adapters/shopify` and `adapters/xero` call the real REST APIs.
- **Both OAuth flows** — Shopify (HMAC-verified) and Xero (OAuth 2.0 + token refresh).
- **Recurring billing** — Shopify Billing API; a **subscription gate** blocks audits/fixes
  until a subscription is active (test charges by default).
- **Embedded in Shopify admin** — App Bridge tags + `frame-ancestors` CSP + `shopify.app.toml`,
  so the app loads inside the admin iframe. (UI is server-rendered and Polaris-styled; for a
  full Polaris React surface, `shopify app dev` can wrap this engine.)
- **One-click fixes** — each fixable issue offers a correction written back to Xero:
  *delete duplicate* and *create missing transaction*.
- **Production webhooks** — `app/uninstalled`, `app_subscriptions/update`, and the three
  **mandatory GDPR** compliance webhooks (`customers/data_request`, `customers/redact`,
  `shop/redact`), all HMAC-verified at `POST /webhooks` and declared in `shopify.app.toml`.

### One-click fixes & safety

Fixes are **preview-only by default**. They write to Xero only when `ALLOW_XERO_WRITES=true`.
Creating a missing transaction also needs two values from you (the app tells you if they're absent):

| Variable | Needed for | Notes |
|---|---|---|
| `ALLOW_XERO_WRITES` | all writes | must be exactly `true` to apply; otherwise preview |
| `XERO_BANK_ACCOUNT_CODE` | create-missing | Xero bank account payouts settle into |
| `XERO_SALES_ACCOUNT_CODE` | create-missing | Xero revenue account to post sales to |
| `XERO_CONTACT_NAME` | create-missing | defaults to `Shopify` |

The Xero scope is `accounting.transactions` (read + write) so fixes can post corrections.

## Remaining for App Store launch

1. **Full Polaris React UI** — the embedded UI is server-rendered and Polaris-*styled* today;
   optionally migrate to Polaris React components via the Shopify CLI app shell.
2. **Production token storage** — replace the local JSON token store with an encrypted DB.
3. **Listing** — optimize for the search terms merchants actually use
   (e.g., "xero reconciliation", "multi-currency", "payout audit").
