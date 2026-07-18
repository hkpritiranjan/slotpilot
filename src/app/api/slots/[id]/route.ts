import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { triggerWaitlistForSlot } from "@/lib/waitlist-engine";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, patientName, patientPhone, notes } = body;

  const slot = await db.slot.findUnique({ where: { id } });
  if (!slot || slot.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.slot.update({
    where: { id },
    data: {
      status: status ?? slot.status,
      patientName: patientName !== undefined ? patientName : slot.patientName,
      patientPhone: patientPhone !== undefined ? patientPhone : slot.patientPhone,
      notes: notes !== undefined ? notes : slot.notes,
    },
  });

  let waitlistResult = null;
  if ((status === "cancelled" || status === "no_show") && slot.status === "booked") {
    waitlistResult = await triggerWaitlistForSlot(id);
  } else if (status === "cancelled" && slot.status === "available") {
    waitlistResult = await triggerWaitlistForSlot(id);
  }

  return Response.json({ slot: updated, waitlist: waitlistResult });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const slot = await db.slot.findUnique({ where: { id } });
  if (!slot || slot.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.notification.deleteMany({ where: { slotId: id } });
  await db.reminder.deleteMany({ where: { slotId: id } });
  await db.slot.delete({ where: { id } });

  return Response.json({ ok: true });
}
