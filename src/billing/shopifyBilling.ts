import type { AppConfig } from "../config.js";

/**
 * Recurring billing via the Shopify Billing API (`appSubscriptionCreate`).
 *
 * The merchant pays on their existing Shopify invoice — no separate checkout.
 * Pricing hypothesis to validate: $19–39/mo "accounting-accuracy insurance".
 */
export interface Plan {
  id: string;
  name: string;
  priceUsd: number;
  /** Soft cap used for tiering; not enforced here. */
  monthlyPayoutLimit: number;
}

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", priceUsd: 19, monthlyPayoutLimit: 100 },
  { id: "growth", name: "Growth", priceUsd: 39, monthlyPayoutLimit: 1000 },
];

const MUTATION = `
  mutation appSubscriptionCreate($name: String!, $price: Decimal!, $returnUrl: URL!, $test: Boolean!) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: [{
        plan: { appRecurringPricingDetails: {
          price: { amount: $price, currencyCode: USD }
          interval: EVERY_30_DAYS
        } }
      }]
    ) {
      confirmationUrl
      userErrors { field message }
    }
  }`;

interface SubscriptionCreateResponse {
  data?: {
    appSubscriptionCreate?: {
      confirmationUrl?: string;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  };
}

/**
 * Create a recurring subscription and return the merchant-facing confirmation
 * URL to redirect to. `test: true` keeps charges in test mode until you go live.
 */
export async function createSubscription(
  config: AppConfig,
  shop: string,
  accessToken: string,
  plan: Plan,
  test = true,
): Promise<{ confirmationUrl: string }> {
  const res = await fetch(
    `https://${shop}/admin/api/${config.shopify.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: MUTATION,
        variables: {
          name: `Reconcilio — ${plan.name}`,
          price: plan.priceUsd,
          returnUrl: `${config.appUrl}/billing/return`,
          test,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Billing request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as SubscriptionCreateResponse;
  const result = json.data?.appSubscriptionCreate;
  if (!result?.confirmationUrl) {
    const errs = result?.userErrors?.map((e) => e.message).join("; ") ?? "unknown error";
    throw new Error(`Could not create subscription: ${errs}`);
  }
  return { confirmationUrl: result.confirmationUrl };
}

const ACTIVE_SUBS_QUERY = `
  { currentAppInstallation { activeSubscriptions { name status } } }`;

interface ActiveSubsResponse {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions?: Array<{ name: string; status: string }>;
    };
  };
}

/** Return the merchant's active subscription, if any (for the feature gate). */
export async function getActiveSubscription(
  config: AppConfig,
  shop: string,
  accessToken: string,
): Promise<{ active: boolean; name?: string }> {
  const res = await fetch(
    `https://${shop}/admin/api/${config.shopify.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: ACTIVE_SUBS_QUERY }),
    },
  );
  if (!res.ok) {
    throw new Error(`Billing status request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as ActiveSubsResponse;
  const sub = json.data?.currentAppInstallation?.activeSubscriptions?.find(
    (s) => s.status === "ACTIVE",
  );
  return sub ? { active: true, name: sub.name } : { active: false };
}
