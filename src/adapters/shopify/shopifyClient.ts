import type { ShopifyPayout } from "../../types.js";
import type { AppConfig } from "../../config.js";
import { round2 } from "../../core/utils.js";

/**
 * Shopify adapter — fetches Shopify Payments payouts and normalizes them into
 * the engine's `ShopifyPayout` model.
 *
 * Uses the REST Admin API directly (Node global `fetch`), so there is no heavy
 * SDK to keep in sync. Scope required: `read_shopify_payments_payouts`.
 */
interface RawPayoutSummary {
  charges_fee_amount?: string;
  refunds_fee_amount?: string;
  adjustments_fee_amount?: string;
}

interface RawPayout {
  id: number;
  date: string;
  currency: string;
  /** Net amount actually deposited to the bank. */
  amount: string;
  summary?: RawPayoutSummary;
}

export class ShopifyClient {
  constructor(
    private readonly config: AppConfig,
    private readonly shop: string,
    private readonly accessToken: string,
  ) {}

  /** Fetch payouts in `[since, until]` (YYYY-MM-DD) and return normalized records. */
  async fetchPayouts(since: string, until: string): Promise<ShopifyPayout[]> {
    const url = new URL(
      `https://${this.shop}/admin/api/${this.config.shopify.apiVersion}/shopify_payments/payouts.json`,
    );
    url.searchParams.set("date_min", since);
    url.searchParams.set("date_max", until);

    const res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": this.accessToken, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Shopify payouts request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { payouts: RawPayout[] };
    return data.payouts.map((p) => this.normalize(p));
  }

  private normalize(p: RawPayout): ShopifyPayout {
    const net = Number(p.amount);
    const s = p.summary ?? {};
    const fees =
      Number(s.charges_fee_amount ?? 0) +
      Number(s.refunds_fee_amount ?? 0) +
      Number(s.adjustments_fee_amount ?? 0);
    return {
      id: String(p.id),
      date: p.date,
      gross: round2(net + fees),
      fees: round2(fees),
      net: round2(net),
      currency: p.currency,
    };
  }
}
