import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleWaitlistReply } from "@/lib/waitlist-engine";

// Meta sends a GET for webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// Meta sends a POST for each incoming message
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return Response.json({ ok: true }); // ack early on bad body

  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const messages = change?.value?.messages ?? [];
      for (const msg of messages) {
        const from: string = msg?.from ?? ""; // digits only, no +
        const text: string = (msg?.text?.body ?? "").trim().toUpperCase();

        if (!from || !text) continue;

        const phone = `+${from}`;
        const reply = text.startsWith("YES") ? "yes"
          : text.startsWith("NO") ? "no"
          : null;

        if (!reply) continue;

        const notification = await db.notification.findFirst({
          where: {
            response: "pending",
            waitlistEntry: { patientPhone: phone },
          },
          orderBy: { sentAt: "desc" },
        });

        if (notification) {
          await handleWaitlistReply(notification.id, reply as "yes" | "no");
        }
      }
    }
  }

  return Response.json({ ok: true });
}
