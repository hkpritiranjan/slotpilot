import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = { clinicId: session.clinicId };
  if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  } else if (date) {
    where.date = date;
  }

  const slots = await db.slot.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      notifications: {
        where: { response: "pending" },
        select: { id: true, expiresAt: true, waitlistEntry: { select: { patientName: true } } },
      },
    },
  });

  return Response.json(slots);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, startTime, endTime, appointmentType, practitioner, patientName, patientPhone, notes } = body;

  if (!date || !startTime || !endTime || !appointmentType) {
    return Response.json({ error: "date, startTime, endTime, appointmentType are required" }, { status: 400 });
  }

  const status = patientName ? "booked" : "available";

  const slot = await db.slot.create({
    data: {
      clinicId: session.clinicId,
      date,
      startTime,
      endTime,
      appointmentType,
      practitioner: practitioner || null,
      patientName: patientName || null,
      patientPhone: patientPhone || null,
      notes: notes || null,
      status,
    },
  });

  return Response.json(slot, { status: 201 });
}
