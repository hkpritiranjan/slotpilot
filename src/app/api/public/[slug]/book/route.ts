import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/sms";

function formatDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [h, min] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${d}/${m}/${y} at ${h12}:${min}${ampm}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { slotId, patientName, patientPhone, channel } = await req.json();

  if (!slotId || !patientName || !patientPhone) {
    return Response.json({ error: "slotId, patientName, patientPhone are required" }, { status: 400 });
  }

  const clinic = await db.clinic.findUnique({ where: { slug } });
  if (!clinic) return Response.json({ error: "Clinic not found" }, { status: 404 });

  const slot = await db.slot.findUnique({ where: { id: slotId } });
  if (!slot) return Response.json({ error: "Slot not found" }, { status: 404 });
  if (slot.clinicId !== clinic.id) return Response.json({ error: "Slot not found" }, { status: 404 });
  if (slot.status !== "available") {
    return Response.json({ error: "This slot is no longer available" }, { status: 409 });
  }

  await db.slot.update({
    where: { id: slotId },
    data: {
      status: "booked",
      patientName,
      patientPhone,
    },
  });

  // Create reminders
  await db.reminder.createMany({
    data: [
      { slotId, type: "24h", status: "pending" },
      { slotId, type: "2h", status: "pending" },
    ],
  });

  const datetime = formatDateTime(slot.date, slot.startTime);
  const ch = (channel === "sms" ? "sms" : "whatsapp") as "sms" | "whatsapp";

  await sendMessage({
    clinicId: clinic.id,
    to: patientPhone,
    body: `Confirmed! Your ${slot.appointmentType} at ${clinic.name} is booked for ${datetime}. See you then! Reply CANCEL to cancel.`,
    tag: "direct_booking",
    channel: ch,
  });

  return Response.json({ ok: true, datetime });
}
