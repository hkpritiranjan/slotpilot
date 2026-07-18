import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { handleWaitlistReply } from "@/lib/waitlist-engine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId, response } = await req.json();

  if (!notificationId || !["yes", "no"].includes(response)) {
    return Response.json({ error: "notificationId and response (yes/no) required" }, { status: 400 });
  }

  // Verify this notification belongs to this clinic
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    include: { slot: { select: { clinicId: true, patientPhone: true } }, waitlistEntry: { select: { patientPhone: true } } },
  });

  if (!notification || notification.slot.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Record the inbound SMS
  await db.smsMessage.create({
    data: {
      clinicId: session.clinicId,
      to: "SlotPilot",
      from: notification.waitlistEntry.patientPhone,
      body: response.toUpperCase(),
      direction: "inbound",
      tag: "patient_reply",
    },
  });

  const result = await handleWaitlistReply(notificationId, response as "yes" | "no");

  return Response.json(result);
}
