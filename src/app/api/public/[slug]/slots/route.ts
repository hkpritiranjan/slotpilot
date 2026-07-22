import { NextRequest } from "next/server";
import { db } from "@/lib/db";

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const clinic = await db.clinic.findUnique({
    where: { slug },
    select: { id: true, name: true, address: true, phone: true, appointmentTypes: true },
  });
  if (!clinic) return Response.json({ error: "Clinic not found" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const daysAhead = Math.min(Number(searchParams.get("days") ?? "7"), 30);

  // Build date range from today
  const today = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const startDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const endDate = addDays(startDate, daysAhead - 1);

  const slots = await db.slot.findMany({
    where: {
      clinicId: clinic.id,
      status: "available",
      date: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      appointmentType: true,
      practitioner: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return Response.json({ clinic, slots, startDate, endDate });
}
