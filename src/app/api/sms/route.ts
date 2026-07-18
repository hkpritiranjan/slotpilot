import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await db.smsMessage.findMany({
    where: { clinicId: session.clinicId },
    orderBy: { createdAt: "desc" },
  });

  // Get pending notifications so UI can show simulate buttons
  const pending = await db.notification.findMany({
    where: {
      response: "pending",
      slot: { clinicId: session.clinicId },
    },
    include: {
      waitlistEntry: { select: { patientName: true, patientPhone: true } },
      slot: { select: { date: true, startTime: true, appointmentType: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  return Response.json({ messages, pendingNotifications: pending });
}
