import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clinic = await db.clinic.findUnique({
    where: { id: session.clinicId },
    select: { id: true, name: true, email: true, phone: true, slug: true, address: true, appointmentTypes: true, slotDuration: true },
  });

  return Response.json(clinic);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, address, appointmentTypes, slotDuration } = body;

  const clinic = await db.clinic.update({
    where: { id: session.clinicId },
    data: { name, phone, address, appointmentTypes, slotDuration },
    select: { id: true, name: true, slug: true },
  });

  return Response.json(clinic);
}
