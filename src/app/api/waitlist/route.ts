import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { clinicId: session.clinicId };
  if (status) where.status = status;

  const entries = await db.waitlistEntry.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      notifications: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true, response: true, expiresAt: true, sentAt: true },
      },
    },
  });

  return Response.json(entries);
}

// Public join (no auth required) - called from patient page
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clinicId, patientName, patientPhone, appointmentType, preferredDays, preferredTime } = body;

  if (!clinicId || !patientName || !patientPhone || !appointmentType) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const clinic = await db.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return Response.json({ error: "Clinic not found" }, { status: 404 });

  // Check for duplicate
  const existing = await db.waitlistEntry.findFirst({
    where: {
      clinicId,
      patientPhone,
      appointmentType,
      status: { in: ["waiting", "notified"] },
    },
  });

  if (existing) {
    return Response.json({ error: "You are already on the waitlist for this appointment type" }, { status: 409 });
  }

  const entry = await db.waitlistEntry.create({
    data: {
      clinicId,
      patientName,
      patientPhone,
      appointmentType,
      preferredDays: preferredDays || null,
      preferredTime: preferredTime || "any",
    },
  });

  return Response.json(entry, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, priority, status } = await req.json();

  const entry = await db.waitlistEntry.findUnique({ where: { id } });
  if (!entry || entry.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.waitlistEntry.update({
    where: { id },
    data: {
      priority: priority !== undefined ? priority : entry.priority,
      status: status !== undefined ? status : entry.status,
    },
  });

  return Response.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const entry = await db.waitlistEntry.findUnique({ where: { id } });
  if (!entry || entry.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.waitlistEntry.delete({ where: { id } });
  return Response.json({ ok: true });
}
