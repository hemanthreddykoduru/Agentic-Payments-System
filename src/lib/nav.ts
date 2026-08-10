/**
 * The sidebar, modelled on Razorpay's — minus everything that needs custody of money.
 *
 * `href` means it exists. `soon` renders as a dimmed label, never a dead button.
 * When a phase ships, move the item from `soon` to `href`. That is the only edit.
 */
export type NavItem = { label: string; href?: string; soon?: true };

export const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Home", href: "/app" },
      { label: "Transactions", href: "/app/orders" },
      { label: "Books", href: "/app/books" },
    ],
  },
  {
    group: "Payment products",
    items: [
      { label: "Payment links", href: "/app/links" },
      { label: "QR codes", href: "/app/qr" },
      { label: "Invoices", soon: true },
      { label: "Subscriptions", soon: true },
    ],
  },
  {
    group: "Customers",
    items: [{ label: "Customers", href: "/app/customers" }],
  },
  {
    group: "Developers",
    items: [
      { label: "API keys", soon: true },
      { label: "Webhooks", soon: true },
      { label: "MCP server", soon: true },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Settings", href: "/app/settings" },
      { label: "Team", href: "/app/team" },
    ],
  },
];

/**
 * Razorpay sidebar items this product will never have, and the reason.
 * Kept in code so nobody re-proposes them in a planning session.
 */
export const NEVER: [string, string][] = [
  ["Settlements", "Money is already in the merchant's account. There is nothing to settle."],
  ["Smart Collect", "Virtual accounts are issued by a bank to a licensed aggregator."],
  ["Optimizer", "Routing between processors requires holding the payment first."],
  ["X Payroll", "Paying salaries out is a payout licence, not a payments one."],
  ["Affordability / EMI", "Card EMI needs issuer relationships and card acceptance."],
  ["Checkout Rewards", "Funded by interchange we never touch."],
  ["Capital / lending", "A different licence and a balance sheet."],
];
