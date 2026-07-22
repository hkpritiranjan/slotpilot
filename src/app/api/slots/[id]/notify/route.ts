import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { triggerWaitlistForSlot } from "@/lib/waitlist-engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const slot = await db.slot.findUnique({ where: { id } });
  if (!slot || slot.clinicId !== session.clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (slot.status !== "available") {
    return Response.json({ error: "Only available slots can be offered to the waitlist" }, { status: 400 });
  }

  const result = await triggerWaitlistForSlot(id);
  return Response.json(result);
}
