import { NextRequest } from "next/server";
import { processReminders } from "@/lib/waitlist-engine";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
}

// Called every 15 minutes by cron-job.org (or Vercel Cron on Pro)
// Sends 24h and 2h appointment reminders across all clinics
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sent } = await processReminders(); // no clinicId = all clinics
  return Response.json({ ok: true, remindersSent: sent });
}
