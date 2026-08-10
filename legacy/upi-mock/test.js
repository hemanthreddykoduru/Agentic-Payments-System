// End-to-end check against a running server: node --env-file=.env test.js
import assert from "node:assert/strict";

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

// bad amounts are rejected
for (const amount of [0, -5, "abc", 149.001, 999999, null]) {
  assert.equal((await post("/create-order", { amount })).status, 400, `accepted ${amount}`);
}

// happy path
const order = await (await post("/create-order", { amount: 149.01 })).json();
assert.match(order.upi_link, /^upi:\/\/pay\?pa=9966659900%40ybl&pn=Hemanth%20Reddy&am=149\.01&mam=149\.01&cu=INR&tr=ORD/);
assert.equal((await (await fetch(`${BASE}/order-status/${order.order_id}`)).json()).status, "PENDING");

// webhook needs the token, the right amount, and a known order
assert.equal((await post("/mock-webhook", { order_id: order.order_id, amount: "149.01", status: "PAID" })).status, 401);
const auth = { "x-webhook-token": process.env.MOCK_WEBHOOK_TOKEN };
assert.equal((await post("/mock-webhook", { order_id: order.order_id, amount: "1.00", status: "PAID" }, auth)).status, 400);
assert.equal((await post("/mock-webhook", { order_id: "NOPE", amount: "149.01", status: "PAID" }, auth)).status, 404);
assert.equal((await post("/mock-webhook", { order_id: order.order_id, amount: "149.01", status: "PAID" }, auth)).status, 200);

// paid orders stay paid, and carry a server-side timestamp for the receipt
const paid = await (await fetch(`${BASE}/order-status/${order.order_id}`)).json();
assert.equal(paid.status, "PAID");
assert.ok(!Number.isNaN(Date.parse(paid.paid_at)), "paid_at should be a timestamp");
assert.equal((await post("/mock-webhook", { order_id: order.order_id, amount: "149.01", status: "FAILED" }, auth)).status, 409);

// admin helper
const o2 = await (await post("/create-order", { amount: 10 })).json();
// DEV_UI=1 deliberately removes this token check so the browser button can work.
const expected = process.env.DEV_UI === "1" ? 200 : 401;
assert.equal((await post("/admin/simulate-payment", { order_id: o2.order_id })).status, expected);
const admin = { "x-admin-token": process.env.ADMIN_TOKEN };
assert.equal((await post("/admin/simulate-payment", { order_id: o2.order_id }, admin)).status, 409); // already paid above
const o2b = await (await post("/create-order", { amount: 10 })).json();
assert.equal((await (await post("/admin/simulate-payment", { order_id: o2b.order_id }, admin)).json()).status, "PAID");

// Expiry. Only runs when the server is configured with a short TTL, since the real
// one is 60s and no check is worth a minute of waiting:
//   ORDER_TTL_SECONDS=2 npm start   (other terminal)
//   ORDER_TTL_SECONDS=2 npm test
const ttl = Number(process.env.ORDER_TTL_SECONDS || 60);
if (ttl <= 3) {
  const o3 = await (await post("/create-order", { amount: 25 })).json();
  assert.equal(o3.expires_in, ttl);
  await new Promise(r => setTimeout(r, ttl * 1000 + 300));
  assert.equal((await (await fetch(`${BASE}/order-status/${o3.order_id}`)).json()).status, "EXPIRED");
  // an expired QR must not be payable by any route
  assert.equal((await post("/mock-webhook", { order_id: o3.order_id, amount: "25.00", status: "PAID" }, auth)).status, 409);
  assert.equal((await post("/admin/simulate-payment", { order_id: o3.order_id }, admin)).status, 409);
  console.log("expiry ok");
} else {
  console.log(`expiry check skipped (TTL is ${ttl}s — rerun both with ORDER_TTL_SECONDS=2)`);
}

console.log("ok");
