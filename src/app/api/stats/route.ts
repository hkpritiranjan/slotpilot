import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { parseApptTypes, feeByTypeName } from "@/lib/appointment-types";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
  const weekStart = weekAgo.toISOString().slice(0, 10);
  const monthStart = monthAgo.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const clinic = await db.clinic.findUnique({
    where: { id: session.clinicId },
    select: { appointmentTypes: true },
  });
  const fees = feeByTypeName(parseApptTypes(clinic?.appointmentTypes ?? ""));

  // All notifications for this clinic in the last 30 days
  const monthNotifs = await db.notification.findMany({
    where: {
      slot: {
        clinicId: session.clinicId,
        date: { gte: monthStart, lte: today },
      },
    },
    select: {
      slotId: true,
      response: true,
      sentAt: true,
      respondedAt: true,
      slot: { select: { appointmentType: true, date: true } },
    },
  });

  const weekNotifs = monthNotifs.filter((n) => n.slot.date >= weekStart);

  // Recovered = response "yes"
  const recoveredMonth = monthNotifs.filter((n) => n.response === "yes");
  const recoveredWeek = weekNotifs.filter((n) => n.response === "yes");

  const revenueWeek = recoveredWeek.reduce((s, n) => s + (fees[n.slot.appointmentType] ?? 0), 0);
  const revenueMonth = recoveredMonth.reduce((s, n) => s + (fees[n.slot.appointmentType] ?? 0), 0);

  // Fill rate: recovered slots / unique slots that had at least one notification
  const offeredSlots = new Set(monthNotifs.map((n) => n.slotId));
  const recoveredSlots = new Set(recoveredMonth.map((n) => n.slotId));
  const fillRate = offeredSlots.size > 0 ? Math.round((recoveredSlots.size / offeredSlots.size) * 100) : 0;

  // Average fill time (minutes from offer sent to patient accepting)
  const yesWithTime = recoveredMonth.filter((n) => n.respondedAt != null);
  const avgFillMinutes =
    yesWithTime.length > 0
      ? Math.round(
          yesWithTime.reduce((s, n) => {
            return s + (new Date(n.respondedAt!).getTime() - new Date(n.sentAt).getTime()) / 60000;
          }, 0) / yesWithTime.length
        )
      : null;

  const hasFees = Object.values(fees).some((f) => f > 0);

  return Response.json({
    recoveredWeek: recoveredWeek.length,
    recoveredMonth: recoveredMonth.length,
    revenueWeek,
    revenueMonth,
    fillRate,
    avgFillMinutes,
    hasFees,
  });
}
