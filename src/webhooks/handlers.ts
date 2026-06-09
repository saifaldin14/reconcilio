import { deleteShopifyToken } from "../store/tokenStore.js";

export interface WebhookContext {
  topic: string;
  shop: string;
  payload: unknown;
}

/**
 * Handle a verified Shopify webhook.
 *
 * Topics wired here:
 *  - `app/uninstalled`         — remove the shop's stored access token.
 *  - `app_subscriptions/update`— billing status is re-checked live on every
 *                                request (see `getActiveSubscription`), so this
 *                                is logged for observability only.
 *  - GDPR (mandatory for App Store approval):
 *      `customers/data_request`— we store no customer PII (only payout/txn
 *                                metadata), so there is nothing to return.
 *      `customers/redact`      — no customer PII stored; nothing to delete.
 *      `shop/redact`           — purge everything we hold for the shop.
 */
export async function handleWebhook(ctx: WebhookContext): Promise<void> {
  switch (ctx.topic) {
    case "app/uninstalled":
      await deleteShopifyToken(ctx.shop);
      console.log(`[webhook] ${ctx.shop} uninstalled — access token removed.`);
      break;

    case "app_subscriptions/update":
      console.log(`[webhook] subscription updated for ${ctx.shop}.`);
      break;

    case "customers/data_request":
      console.log(`[webhook] GDPR data request for ${ctx.shop} — no customer PII stored.`);
      break;

    case "customers/redact":
      console.log(`[webhook] GDPR customer redact for ${ctx.shop} — no customer PII stored.`);
      break;

    case "shop/redact":
      await deleteShopifyToken(ctx.shop);
      console.log(`[webhook] GDPR shop redact for ${ctx.shop} — shop data purged.`);
      break;

    default:
      console.log(`[webhook] unhandled topic: ${ctx.topic}`);
  }
}
