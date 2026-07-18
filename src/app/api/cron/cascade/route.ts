import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { triggerWaitlistForSlot } from "@/lib/waitlist-engine";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // require explicit config
  return req.headers.get("x-cron-secret") === secret;
}

// Called every 5 minutes by cron-job.org (or Vercel Cron on Pro)
// Finds expired pending notifications and cascades to the next patient
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all slots that have at least one expired pending notification
  const expiredNotifications = await db.notification.findMany({
    where: { response: "pending", expiresAt: { lt: now } },
    select: { slotId: true },
    distinct: ["slotId"],
  });

  let cascaded = 0;
  for (const { slotId } of expiredNotifications) {
    const result = await triggerWaitlistForSlot(slotId);
    if (result.notified) cascaded++;
  }

  return Response.json({
    ok: true,
    slotsChecked: expiredNotifications.length,
    cascaded,
  });
}
