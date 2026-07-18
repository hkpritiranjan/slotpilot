import { getSession } from "@/lib/session";
import { processReminders } from "@/lib/waitlist-engine";

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await processReminders(session.clinicId);

  return Response.json(result);
}
