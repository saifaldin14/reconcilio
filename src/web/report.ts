import type { AuditResult, Severity } from "../types.js";

const COLOR: Record<Severity, string> = {
  high: "#c0392b",
  medium: "#d68910",
  low: "#7f8c8d",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

let EMBED_API_KEY: string | undefined;

/** Enable Shopify-admin embedding (App Bridge). Call once at startup. */
export function configureEmbedding(apiKey: string): void {
  EMBED_API_KEY = apiKey;
}

/** App Bridge tags so the app loads correctly inside the Shopify admin iframe. */
function embedHead(): string {
  if (!EMBED_API_KEY) return "";
  return `<meta name="shopify-api-key" content="${esc(EMBED_API_KEY)}" />
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`;
}

function scoreBadge(score: number): { label: string; color: string } {
  if (score >= 90) return { label: `${score}/100 · Healthy`, color: "#1e8449" };
  if (score >= 60) return { label: `${score}/100 · Needs attention`, color: "#d68910" };
  return { label: `${score}/100 · At risk`, color: "#c0392b" };
}

export function layout(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root{--bg:#f1f1f1;--surface:#fff;--text:#202223;--subdued:#6d7175;--border:#e1e3e5;--primary:#008060;--primary-hover:#006e52;--critical:#d72c0d}
  *{box-sizing:border-box}
  body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;background:var(--bg);color:var(--text);margin:0;line-height:1.5;font-size:14px}
  .topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:14px 20px;font-weight:600;font-size:15px}
  .wrap{max-width:760px;margin:0 auto;padding:24px 20px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin:16px 0;box-shadow:0 1px 0 rgba(0,0,0,.04)}
  .btn{display:inline-block;background:var(--primary);color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;margin-right:8px;border:0;cursor:pointer;font-size:14px;font-weight:500}
  .btn:hover{background:var(--primary-hover)}
  .btn.alt{background:#13b5ea}
  .btn.alt:hover{background:#0e93bf}
  .badge{display:inline-block;color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500}
  .issue{border-left:4px solid var(--border);padding:10px 14px;margin:10px 0;background:#fafbfb;border-radius:0 8px 8px 0}
  .muted{color:var(--subdued);font-size:13px}
  input{padding:9px 12px;border:1px solid #aeb4b9;border-radius:8px;width:260px;font-size:14px}
  h1{font-size:20px;margin:0 0 6px} h2{font-size:15px;margin:0 0 8px}
  pre{white-space:pre-wrap;background:#f6f6f7;padding:12px;border-radius:8px;font-size:13px}
</style>${embedHead()}</head><body>
<div class="topbar">Reconcilio</div>
<div class="wrap">${body}</div>
</body></html>`;
}

/** Connect screen shown until both Shopify and Xero are linked. */
export function renderConnect(opts: {
  shopifyConnected: boolean;
  xeroConnected: boolean;
  shop?: string;
}): string {
  const body = `
  <h1>Connect your accounts</h1>
  <p class="muted">Reconcilio audits your Shopify → Xero books for missing payouts, duplicates,
  unbooked fees, FX errors, and unreconciled deposits. Connect both accounts to begin.</p>
  <div class="card">
    <h2>1. Shopify ${opts.shopifyConnected ? "✓ connected" : ""}</h2>
    ${
      opts.shopifyConnected
        ? `<p class="muted">${esc(opts.shop ?? "")}</p>`
        : `<form action="/auth/shopify" method="get">
             <input name="shop" placeholder="your-store.myshopify.com" required />
             <button class="btn" type="submit">Connect Shopify</button>
           </form>`
    }
  </div>
  <div class="card">
    <h2>2. Xero ${opts.xeroConnected ? "✓ connected" : ""}</h2>
    ${
      opts.xeroConnected
        ? `<p class="muted">Organisation connected.</p>`
        : `<a class="btn alt" href="/auth/xero">Connect Xero</a>`
    }
  </div>
  ${opts.shopifyConnected && opts.xeroConnected ? `<a class="btn" href="/">Run audit →</a>` : ""}`;
  return layout("Reconcilio", body);
}

/** Books Health report from a completed audit. */
export function renderReport(result: AuditResult, ctx: { shop?: string }): string {
  const badge = scoreBadge(result.healthScore);
  const issues = result.issues
    .map(
      (i, idx) => `
    <div class="issue" style="border-left-color:${COLOR[i.severity]}">
      <strong>${esc(i.title)}</strong>
      ${i.impact ? `<span class="muted">≈ ${i.impact.amount} ${esc(i.impact.currency)}</span>` : ""}
      <div class="muted">${esc(i.detail)}</div>
      ${
        i.fix
          ? `<div style="margin-top:6px"><a class="btn" href="/fix?index=${idx}">Fix this →</a> <span class="muted">${esc(i.fix.label)}</span></div>`
          : ""
      }
    </div>`,
    )
    .join("");

  const body = `
  <h1>Books Health Report</h1>
  <p><span class="badge" style="background:${badge.color}">${esc(badge.label)}</span></p>
  <p class="muted">${result.summary.checkedPayouts} payouts checked ·
    ${result.summary.high} high · ${result.summary.medium} medium · ${result.summary.low} low${
      ctx.shop ? ` · ${esc(ctx.shop)}` : ""
    }</p>
  ${
    result.issues.length === 0
      ? `<p>No discrepancies found. Books look reconciled. 🎉</p>`
      : issues
  }
  <p style="margin-top:18px">
    <a class="btn" href="/billing/subscribe?plan=growth">Subscribe</a>
    <a href="/audit.json" class="muted">View JSON</a>
  </p>`;
  return layout("Books Health Report", body);
}

/** Shown when both accounts are connected but no active subscription exists. */
export function renderPaywall(
  plans: Array<{ id: string; name: string; priceUsd: number }>,
  opts: { note?: string } = {},
): string {
  const cards = plans
    .map(
      (p) => `
    <div class="card">
      <h2>${esc(p.name)} — $${p.priceUsd}/mo</h2>
      <a class="btn" href="/billing/subscribe?plan=${encodeURIComponent(p.id)}">Subscribe</a>
    </div>`,
    )
    .join("");
  const body = `
  <h1>Start your subscription</h1>
  <p class="muted">Both accounts are connected. Subscribe to run audits and apply fixes.</p>
  ${opts.note ? `<p class="muted">${esc(opts.note)}</p>` : ""}
  ${cards}`;
  return layout("Subscribe — Reconcilio", body);
}

/** Confirmation page before writing a correction back to Xero. */
export function renderFixConfirm(
  fixLabel: string,
  index: number,
  opts: { allowWrites: boolean },
): string {
  const body = `
  <h1>Confirm fix</h1>
  <div class="card">
    <p>${esc(fixLabel)}</p>
    <p class="muted">${
      opts.allowWrites
        ? "This will write a change to your Xero organisation."
        : "Preview mode: ALLOW_XERO_WRITES is not enabled, so this will be simulated and nothing will be written."
    }</p>
    <form action="/fix" method="post">
      <input type="hidden" name="index" value="${index}" />
      <button class="btn" type="submit">${opts.allowWrites ? "Apply fix" : "Run preview"}</button>
      <a class="muted" href="/">Cancel</a>
    </form>
  </div>`;
  return layout("Confirm fix", body);
}

/** Result page after attempting a fix. */
export function renderFixResult(message: string, ok: boolean): string {
  const body = `
  <h1>${ok ? "Done" : "Could not apply fix"}</h1>
  <div class="card"><pre>${esc(message)}</pre></div>
  <a class="btn" href="/">Back to report</a>`;
  return layout(ok ? "Fix applied" : "Fix failed", body);
}
