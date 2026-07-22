import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function timeSlots(
  startTime: string,
  endTime: string,
  durationMins: number
): Array<{ startTime: string; endTime: string }> {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const endMins = eh * 60 + em;
  const result = [];
  let cur = sh * 60 + sm;
  while (cur + durationMins <= endMins) {
    result.push({
      startTime: `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`,
      endTime: `${pad(Math.floor((cur + durationMins) / 60))}:${pad((cur + durationMins) % 60)}`,
    });
    cur += durationMins;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    days,          // string[] e.g. ["Mon", "Wed", "Fri"]
    startTime,     // "09:00"
    endTime,       // "13:00"
    durationMins,  // 30
    appointmentType,
    practitioner,
    startDate,     // "2026-07-28"
    weeksAhead,    // 4
  } = body;

  if (!days?.length || !startTime || !endTime || !durationMins || !appointmentType || !startDate || !weeksAhead) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slots = timeSlots(startTime, endTime, durationMins);
  if (slots.length === 0) {
    return Response.json({ error: "No slots fit in that time range with that duration" }, { status: 400 });
  }

  const totalDays = weeksAhead * 7;
  const toCreate: Array<{
    clinicId: string;
    date: string;
    startTime: string;
    endTime: string;
    appointmentType: string;
    practitioner: string | null;
    status: string;
  }> = [];

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(startDate, i);
    const [y, m, d] = date.split("-").map(Number);
    const dayName = DAY_NAMES[new Date(y, m - 1, d).getDay()];
    if (!days.includes(dayName)) continue;

    for (const s of slots) {
      toCreate.push({
        clinicId: session.clinicId,
        date,
        startTime: s.startTime,
        endTime: s.endTime,
        appointmentType,
        practitioner: practitioner || null,
        status: "available",
      });
    }
  }

  if (toCreate.length === 0) {
    return Response.json({ error: "No matching days in that date range" }, { status: 400 });
  }
  if (toCreate.length > 500) {
    return Response.json({ error: "Too many slots — reduce weeks or days" }, { status: 400 });
  }

  await db.slot.createMany({ data: toCreate });

  return Response.json({ created: toCreate.length });
}
