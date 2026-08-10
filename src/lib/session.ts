import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ponytail: HMAC-signed cookie, no JWT library. It carries two ids and an expiry —
// a JWT would add a dependency to encode the same three fields. Swap to jose if we
// ever need to hand a token to something that isn't this app.

const SECRET = process.env.SESSION_SECRET;
const COOKIE = "ap_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Session = { userId: string; merchantId: string; role: string };

function sign(payload: string): string {
  if (!SECRET) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export async function createSession(s: Session) {
  const payload = JSON.stringify({ ...s, exp: Date.now() + MAX_AGE * 1000 });
  const body = Buffer.from(payload).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  const expected = sign(body);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof d.exp !== "number" || d.exp < Date.now()) return null;
    return { userId: d.userId, merchantId: d.merchantId, role: d.role };
  } catch {
    return null;
  }
}
