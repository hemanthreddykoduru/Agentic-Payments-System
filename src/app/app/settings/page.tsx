import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const merchant = await prisma.merchant.findUniqueOrThrow({ where: { id: session.merchantId } });

  return (
    <div className="max-w-[520px]">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-2 text-[28px]">Where your money goes</h1>

      <SettingsForm
        merchant={{
          name: merchant.name,
          payeeName: merchant.payeeName ?? merchant.name,
          vpa: merchant.vpa ?? "",
          verified: merchant.vpaVerifiedAt !== null,
        }}
        canEdit={session.role === "owner"}
      />
    </div>
  );
}
