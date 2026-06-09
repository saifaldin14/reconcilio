import type { XeroBankTransaction } from "../../types.js";

/**
 * Xero adapter — fetches bank transactions and normalizes them into the
 * engine's `XeroBankTransaction` model. Uses the Accounting REST API directly.
 * Scopes required: `accounting.transactions.read`, `accounting.settings.read`.
 */
interface RawBankTx {
  BankTransactionID: string;
  Total: number;
  CurrencyCode?: string;
  /** Microsoft-JSON date, e.g. "/Date(1715212800000+0000)/". */
  Date?: string;
  /** ISO-ish date string, e.g. "2026-05-09T00:00:00". */
  DateString?: string;
  Reference?: string;
  IsReconciled?: boolean;
}

export class XeroClient {
  constructor(
    private readonly accessToken: string,
    private readonly tenantId: string,
  ) {}

  /** Fetch bank transactions and return those within `[since, until]` (YYYY-MM-DD). */
  async fetchBankTransactions(since: string, until: string): Promise<XeroBankTransaction[]> {
    const res = await fetch("https://api.xero.com/api.xro/2.0/BankTransactions?page=1", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Xero-tenant-id": this.tenantId,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Xero bank transactions request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { BankTransactions?: RawBankTx[] };
    return (data.BankTransactions ?? [])
      .map(normalizeBankTx)
      .filter((t) => t.date >= since && t.date <= until);
  }

  /** Soft-delete a bank transaction (used to remove a duplicate). */
  async deleteBankTransaction(id: string): Promise<void> {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/BankTransactions/${id}`, {
      method: "POST",
      headers: this.writeHeaders(),
      body: JSON.stringify({ BankTransactionID: id, Status: "DELETED" }),
    });
    if (!res.ok) {
      throw new Error(`Xero delete failed: ${res.status} ${await res.text()}`);
    }
  }

  /** Create a RECEIVE bank transaction (used to record a missing payout). */
  async createBankTransaction(input: CreateBankTxInput): Promise<string> {
    const body = {
      Type: "RECEIVE",
      Contact: { Name: input.contactName },
      Date: input.date,
      Reference: input.reference,
      CurrencyCode: input.currency,
      BankAccount: { Code: input.bankAccountCode },
      LineItems: [
        {
          Description: `Shopify payout ${input.reference}`,
          Quantity: 1,
          UnitAmount: input.amount,
          AccountCode: input.salesAccountCode,
        },
      ],
    };
    const res = await fetch("https://api.xero.com/api.xro/2.0/BankTransactions", {
      method: "POST",
      headers: this.writeHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Xero create failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { BankTransactions?: Array<{ BankTransactionID: string }> };
    return data.BankTransactions?.[0]?.BankTransactionID ?? "";
  }

  private writeHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Xero-tenant-id": this.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }
}

export interface CreateBankTxInput {
  date: string;
  amount: number;
  currency: string;
  reference: string;
  contactName: string;
  bankAccountCode: string;
  salesAccountCode: string;
}

function normalizeBankTx(t: RawBankTx): XeroBankTransaction {
  return {
    id: t.BankTransactionID,
    date: parseXeroDate(t),
    amount: t.Total,
    currency: t.CurrencyCode ?? "",
    reference: t.Reference,
    reconciled: Boolean(t.IsReconciled),
  };
}

function parseXeroDate(t: RawBankTx): string {
  if (t.DateString) return t.DateString.slice(0, 10);
  const m = t.Date?.match(/\/Date\((\d+)/);
  if (m && m[1]) return new Date(Number(m[1])).toISOString().slice(0, 10);
  return "";
}
