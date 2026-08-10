// Status columns are String in the schema so a new state needs no migration.
// This file is the single place that says what those strings may be —
// import from here rather than typing status literals at call sites.

export const ORDER_STATUS = [
  "created", "awaiting_confirmation", "paid", "expired", "cancelled",
] as const;

/// No `authorized` or `captured`: those are custody states, and we never take custody.
/// A payment becomes paid because a human confirmed the money reached their bank.
export const PAYMENT_STATUS = [
  "created", "awaiting_confirmation", "paid", "rejected", "expired",
] as const;

export const INVOICE_STATUS = [
  "draft", "issued", "partially_paid", "paid", "overdue", "cancelled",
] as const;
export const SUBSCRIPTION_STATUS = ["active", "paused", "cancelled", "completed"] as const;
export const LINK_STATUS = ["active", "paid", "expired", "cancelled"] as const;
export const WEBHOOK_STATUS = ["pending", "delivered", "failed"] as const;

/// Dr bank_upi / Cr sales. Two legs, summing to zero. No fee or tax legs —
/// we take no cut of money that never passes through us.
export const LEDGER_ACCOUNT = ["bank_upi", "sales"] as const;

export const MODE = ["test", "live"] as const;
export const ROLE = ["owner", "staff", "view_only"] as const;

export const WEBHOOK_EVENTS = ["order.paid", "order.rejected", "order.expired"] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];
export type LinkStatus = (typeof LINK_STATUS)[number];
export type WebhookStatus = (typeof WEBHOOK_STATUS)[number];
export type LedgerAccount = (typeof LEDGER_ACCOUNT)[number];
export type Mode = (typeof MODE)[number];
export type Role = (typeof ROLE)[number];
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export const ID_PREFIX = {
  merchant: "mer",
  user: "usr",
  apiKey: "key",
  webhook: "wh",
  webhookEvent: "evt",
  customer: "cust",
  order: "ord",
  payment: "pay",
  ledger: "ldgr",
  paymentLink: "plink",
  qrCode: "qr",
  invoice: "inv",
  invoiceItem: "item",
  plan: "plan",
  subscription: "sub",
  report: "rpt",
  agent: "agt",
  agentAction: "agtact",
} as const;

/** Formats money held in paise. 149010 -> "₹1,490.10" */
export function formatPaise(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Builds the UPI intent a payer's app opens. `pa` is always the merchant's own VPA —
 * there is no platform VPA, which is what keeps us out of RBI licensing.
 *
 * encodeURIComponent, not URLSearchParams: the latter encodes spaces as "+", which
 * several UPI apps render literally in the payee name.
 */
export function buildUpiIntent(opts: {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  orderId: string;
}): string {
  const amount = (opts.amountPaise / 100).toFixed(2);
  const params: Record<string, string> = {
    pa: opts.vpa,
    pn: opts.payeeName,
    am: amount,
    // mam is honoured inconsistently across UPI apps — send it, never rely on it.
    // The merchant confirming the amount is what actually protects them.
    mam: amount,
    cu: "INR",
    tr: opts.orderId,
  };
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `upi://pay?${qs}`;
}

/** UPI reference numbers are 12 digits. Anything else is a typo, not a payment. */
export function isValidUtr(utr: string): boolean {
  return /^\d{12}$/.test(utr.trim());
}
