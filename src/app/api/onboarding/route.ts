import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [clinic, slotsCount, bookedCount, waitlistCount] = await Promise.all([
    db.clinic.findUnique({
      where: { id: session.clinicId },
      select: { address: true, phone: true },
    }),
    db.slot.count({ where: { clinicId: session.clinicId } }),
    db.slot.count({ where: { clinicId: session.clinicId, status: "booked" } }),
    db.waitlistEntry.count({ where: { clinicId: session.clinicId } }),
  ]);

  return Response.json({
    profileComplete: !!(clinic?.address && clinic?.phone),
    slotsCreated: slotsCount > 0,
    hasPatient: bookedCount > 0 || waitlistCount > 0,
  });
}
