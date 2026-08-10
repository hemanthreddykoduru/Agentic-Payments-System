import express from "express";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";

const { PORT = 3000, UPI_ID, MERCHANT_NAME, MOCK_WEBHOOK_TOKEN, ADMIN_TOKEN, DEV_UI } = process.env;
if (!UPI_ID || !MERCHANT_NAME || !MOCK_WEBHOOK_TOKEN || !ADMIN_TOKEN) {
  throw new Error("Missing env vars. Copy .env.example to .env and fill it in.");
}

// ponytail: in-memory store, orders die on restart. Swap the Map for node:sqlite if you need them to survive.
const orders = new Map();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const MAX_AMOUNT = 100000;
const TTL_MS = Number(process.env.ORDER_TTL_SECONDS || 60) * 1000;

// Expiry is computed on read, not swept by a timer — no cleanup loop to get wrong.
// ponytail: expired orders still occupy the Map forever. Add a sweep if you ever run this for days.
function statusOf(order) {
  if (order.status === "PENDING" && Date.now() > order.expires_at) return "EXPIRED";
  return order.status;
}

// Amount is money: reject anything that isn't a positive number with <= 2 decimals.
function parseAmount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  if (Math.round(n * 100) !== n * 100) return null;
  return n.toFixed(2);
}

function buildUpiLink({ amount, orderId }) {
  const params = {
    pa: UPI_ID,
    pn: MERCHANT_NAME,
    am: amount,
    mam: amount,
    cu: "INR",
    tr: orderId,
  };
  // encodeURIComponent, not URLSearchParams: the latter encodes spaces as "+",
  // which several UPI apps render literally in the merchant name.
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `upi://pay?${qs}`;
}

app.post("/create-order", async (req, res) => {
  const amount = parseAmount(req.body?.amount);
  if (!amount) return res.status(400).json({ error: "Invalid amount" });

  const orderId = "ORD" + randomBytes(6).toString("hex").toUpperCase();
  const upiLink = buildUpiLink({ amount, orderId });

  orders.set(orderId, {
    order_id: orderId,
    amount, // server-owned from here on; the client never gets to restate it
    status: "PENDING",
    created_at: new Date().toISOString(),
    expires_at: Date.now() + TTL_MS,
  });

  res.json({
    order_id: orderId,
    amount,
    upi_link: upiLink,
    qr_text: upiLink,
    qr_data_url: await QRCode.toDataURL(upiLink),
    expires_in: Math.round(TTL_MS / 1000), // the page counts down from this
  });
});

app.get("/order-status/:orderId", (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Unknown order" });
  res.json({
    order_id: order.order_id,
    amount: order.amount,
    status: statusOf(order),
    paid_at: order.paid_at, // undefined until paid; the receipt uses this, not the browser clock
  });
});

// TEST ONLY. Stands in for a real payment-provider webhook. There is no
// signature verification here because there is no real provider — a shared
// token is the whole security model, so keep this server off the public internet.
app.post("/mock-webhook", (req, res) => {
  if (req.get("x-webhook-token") !== MOCK_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: "Bad token" });
  }
  const { order_id, amount, status } = req.body ?? {};
  const order = orders.get(order_id);
  if (!order) return res.status(404).json({ error: "Unknown order" });
  // Covers PAID (replay), FAILED, and EXPIRED — a QR the user can no longer see must not be payable.
  if (statusOf(order) !== "PENDING") return res.status(409).json({ error: `Already ${statusOf(order)}` });
  if (parseAmount(amount) !== order.amount) return res.status(400).json({ error: "Amount mismatch" });
  if (status !== "PAID" && status !== "FAILED") return res.status(400).json({ error: "Bad status" });

  order.status = status;
  if (status === "PAID") order.paid_at = new Date().toISOString();
  res.json({ order_id, status: order.status });
});

// TEST ONLY. Skips the amount check so you can click one button in the UI.
// With DEV_UI=1 it needs no token at all, because the browser has nowhere safe
// to keep one. That is the whole reason DEV_UI must never be on in public.
app.post("/admin/simulate-payment", (req, res) => {
  if (DEV_UI !== "1" && req.get("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Bad token" });
  }
  const order = orders.get(req.body?.order_id);
  if (!order) return res.status(404).json({ error: "Unknown order" });
  if (statusOf(order) !== "PENDING") return res.status(409).json({ error: `Already ${statusOf(order)}` });
  order.status = "PAID";
  order.paid_at = new Date().toISOString();
  res.json({ order_id: order.order_id, status: order.status });
});

// The page needs to know whether to render the Simulate button.
app.get("/dev-mode", (_req, res) => res.json({ dev: DEV_UI === "1" }));

app.listen(PORT, () => {
  if (DEV_UI === "1") console.warn("DEV_UI=1 — /admin/simulate-payment is UNAUTHENTICATED. Localhost only.");
  console.log(`http://localhost:${PORT}`);
});
