import { prisma } from "@/lib/prisma";
import { authenticate, notFound, serializeOrder, serializePayment, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/v1/orders/[orderId]">) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();

  const { orderId } = await ctx.params;
  // merchantId is in the filter, not checked after — another tenant's id is a 404.
  const order = await prisma.order.findFirst({
    where: { id: orderId, merchantId: auth.merchantId },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) return notFound();

  return Response.json({
    ...serializeOrder(order),
    payments: order.payments.map(serializePayment),
  });
}
