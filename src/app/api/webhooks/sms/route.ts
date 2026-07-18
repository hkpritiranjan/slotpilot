import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleWaitlistReply } from "@/lib/waitlist-engine";
import { sendMessage } from "@/lib/sms";

// Strips whatsapp: prefix and normalises to digits-only for DB lookup
function normalizePhone(raw: string): string {
  return raw.replace(/^whatsapp:/, "").replace(/\s/g, "");
}

// Twilio sends application/x-www-form-urlencoded for both SMS and WhatsApp
export async function POST(req: NextRequest) {
  const text = await req.text();
  const params = new URLSearchParams(text);

  const from = params.get("From") ?? "";
  const body = (params.get("Body") ?? "").trim().toUpperCase();

  if (!from || !body) {
    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const phone = normalizePhone(from);
  const reply = body.startsWith("YES") ? "yes"
    : body.startsWith("NO") ? "no"
    : body.startsWith("CANCEL") ? "cancel"
    : null;

  if (!reply) {
    // Unknown keyword — ignore
    return new Response("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  if (reply === "cancel") {
    await handleCancelReply(phone);
  } else {
    // Find the most recent pending notification for this phone number
    const notification = await db.notification.findFirst({
      where: {
        response: "pending",
        waitlistEntry: { patientPhone: phone },
      },
      orderBy: { sentAt: "desc" },
      include: { waitlistEntry: true, slot: { include: { clinic: true } } },
    });

    if (notification) {
      await handleWaitlistReply(notification.id, reply as "yes" | "no");
    }
  }

  // Return empty TwiML — our sendMessage handles the reply SMS
  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function handleCancelReply(phone: string) {
  // Find the most recent booked slot for this patient
  const slot = await db.slot.findFirst({
    where: {
      patientPhone: phone,
      status: "booked",
    },
    orderBy: { createdAt: "desc" },
    include: { clinic: true },
  });

  if (!slot) return;

  await db.slot.update({
    where: { id: slot.id },
    data: { status: "cancelled", patientName: null, patientPhone: null },
  });

  // Confirm cancellation to patient
  await sendMessage({
    clinicId: slot.clinicId,
    to: phone,
    body: `Your ${slot.appointmentType} appointment at ${slot.clinic.name} has been cancelled. We'll let you know if a new slot opens.`,
    tag: "patient_cancelled",
    channel: "sms",
  });

  // Re-trigger waitlist for this slot
  const { triggerWaitlistForSlot } = await import("@/lib/waitlist-engine");
  await triggerWaitlistForSlot(slot.id);
}
