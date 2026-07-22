import { db } from "./db";
import { sendMessage } from "./sms";

const OFFER_WINDOW_MINUTES = 15;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function slotDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function matchesTimePreference(startTime: string, pref: string): boolean {
  if (!pref || pref === "any") return true;
  const [h] = startTime.split(":").map(Number);
  const mins = h * 60 + Number(startTime.split(":")[1]);
  if (pref === "morning") return mins < 720;        // before 12:00
  if (pref === "afternoon") return mins >= 720 && mins < 1020; // 12:00–17:00
  if (pref === "evening") return mins >= 1020;      // 17:00+
  return true;
}

function matchesDayPreference(dateStr: string, preferredDays: string | null): boolean {
  if (!preferredDays) return true;
  const days = preferredDays.split(",").map((d) => d.trim());
  if (days.length === 0) return true;
  return days.includes(slotDayName(dateStr));
}

function formatDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [h, min] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return `${d}/${m}/${y} at ${h12}:${min}${ampm}`;
}

export async function triggerWaitlistForSlot(slotId: string): Promise<{ notified: boolean; patientName?: string }> {
  const slot = await db.slot.findUnique({
    where: { id: slotId },
    include: { clinic: true },
  });
  if (!slot) return { notified: false };

  // Expire any pending notifications for this slot that are past their window
  const now = new Date();
  await db.notification.updateMany({
    where: {
      slotId,
      response: "pending",
      expiresAt: { lt: now },
    },
    data: { response: "expired" },
  });

  // Find next waiting patient — ordered by priority then join time,
  // then filtered in JS for time/day preference so we skip non-matching
  // patients rather than stopping at the first mismatch.
  const allCandidates = await db.waitlistEntry.findMany({
    where: {
      clinicId: slot.clinicId,
      appointmentType: slot.appointmentType,
      status: "waiting",
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const candidate = allCandidates.find(
    (c) =>
      matchesTimePreference(slot.startTime, c.preferredTime) &&
      matchesDayPreference(slot.date, c.preferredDays)
  ) ?? null;

  if (!candidate) return { notified: false };

  const expiresAt = new Date(now.getTime() + OFFER_WINDOW_MINUTES * 60 * 1000);

  await db.notification.create({
    data: {
      waitlistId: candidate.id,
      slotId,
      expiresAt,
      response: "pending",
    },
  });

  await db.waitlistEntry.update({
    where: { id: candidate.id },
    data: { status: "notified" },
  });

  const datetime = formatDateTime(slot.date, slot.startTime);
  const message =
    `Hi ${candidate.patientName}! A ${slot.appointmentType} slot opened at ${slot.clinic.name} on ${datetime}. ` +
    `Reply YES to confirm or NO to skip. Offer expires in ${OFFER_WINDOW_MINUTES} minutes.`;

  await sendMessage({
    clinicId: slot.clinicId,
    to: candidate.patientPhone,
    body: message,
    tag: "waitlist_offer",
    channel: (candidate.preferredChannel ?? "whatsapp") as "sms" | "whatsapp",
  });

  return { notified: true, patientName: candidate.patientName };
}

export async function handleWaitlistReply(
  notificationId: string,
  response: "yes" | "no"
): Promise<{ success: boolean; message: string }> {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    include: {
      waitlistEntry: true,
      slot: { include: { clinic: true } },
    },
  });

  if (!notification) return { success: false, message: "Notification not found" };
  if (notification.response !== "pending") {
    return { success: false, message: `Already responded: ${notification.response}` };
  }

  const now = new Date();
  if (notification.expiresAt < now) {
    await db.notification.update({
      where: { id: notificationId },
      data: { response: "expired" },
    });
    await db.waitlistEntry.update({
      where: { id: notification.waitlistId },
      data: { status: "waiting" },
    });
    return { success: false, message: "Offer has expired — trying next patient" };
  }

  await db.notification.update({
    where: { id: notificationId },
    data: { response, respondedAt: now },
  });

  if (response === "yes") {
    await db.slot.update({
      where: { id: notification.slotId },
      data: {
        status: "booked",
        patientName: notification.waitlistEntry.patientName,
        patientPhone: notification.waitlistEntry.patientPhone,
      },
    });

    await db.waitlistEntry.update({
      where: { id: notification.waitlistId },
      data: { status: "booked" },
    });

    // Expire other pending notifications for this slot
    await db.notification.updateMany({
      where: {
        slotId: notification.slotId,
        id: { not: notificationId },
        response: "pending",
      },
      data: { response: "expired" },
    });

    const datetime = formatDateTime(notification.slot.date, notification.slot.startTime);
    const ch = (notification.waitlistEntry.preferredChannel ?? "whatsapp") as "sms" | "whatsapp";
    await sendMessage({
      clinicId: notification.slot.clinicId,
      to: notification.waitlistEntry.patientPhone,
      body: `Confirmed! Your ${notification.slot.appointmentType} appointment at ${notification.slot.clinic.name} is booked for ${datetime}. See you then!`,
      tag: "booking_confirmed",
      channel: ch,
    });

    // Schedule reminders
    await createRemindersForSlot(notification.slotId);

    return { success: true, message: `Slot booked for ${notification.waitlistEntry.patientName}` };
  } else {
    await db.waitlistEntry.update({
      where: { id: notification.waitlistId },
      data: { status: "waiting" },
    });

    await sendMessage({
      clinicId: notification.slot.clinicId,
      to: notification.waitlistEntry.patientPhone,
      body: `No problem! You're still on the waitlist at ${notification.slot.clinic.name}. We'll notify you when the next slot opens.`,
      tag: "waitlist_declined",
      channel: (notification.waitlistEntry.preferredChannel ?? "whatsapp") as "sms" | "whatsapp",
    });

    // Try next patient
    await triggerWaitlistForSlot(notification.slotId);

    return { success: true, message: "Declined — notifying next patient" };
  }
}

async function createRemindersForSlot(slotId: string): Promise<void> {
  const existing = await db.reminder.findMany({ where: { slotId } });
  const types = existing.map((r) => r.type);

  const toCreate = (["24h", "2h"] as const).filter((t) => !types.includes(t));
  if (toCreate.length === 0) return;

  await db.reminder.createMany({
    data: toCreate.map((type) => ({ slotId, type, status: "pending" })),
  });
}

export async function processReminders(clinicId?: string): Promise<{ sent: number }> {
  const now = new Date();
  let sent = 0;

  const slotFilter = clinicId
    ? { clinicId, status: "booked", patientPhone: { not: null } }
    : { status: "booked", patientPhone: { not: null } };

  const pendingReminders = await db.reminder.findMany({
    where: { status: "pending", slot: slotFilter },
    include: { slot: { include: { clinic: true } } },
  });

  for (const reminder of pendingReminders) {
    const slot = reminder.slot;
    const [y, mo, d] = slot.date.split("-").map(Number);
    const [h, min] = slot.startTime.split(":").map(Number);
    const slotTime = new Date(y, mo - 1, d, h, min);
    const diffMs = slotTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const shouldSend =
      (reminder.type === "24h" && diffHours <= 26 && diffHours >= 22) ||
      (reminder.type === "2h" && diffHours <= 3 && diffHours >= 1);

    if (!shouldSend) continue;

    const datetime = formatDateTime(slot.date, slot.startTime);
    const hoursLabel = reminder.type === "24h" ? "tomorrow" : "in 2 hours";
    const body =
      `Reminder: Your ${slot.appointmentType} at ${slot.clinic.name} is ${hoursLabel} (${datetime}). ` +
      `Reply CANCEL to cancel.`;

    await sendMessage({
      clinicId: slot.clinicId,
      to: slot.patientPhone!,
      body,
      tag: `reminder_${reminder.type}`,
      channel: "sms", // reminders go via SMS by default (no preferredChannel on Slot)
    });

    await db.reminder.update({
      where: { id: reminder.id },
      data: { status: "sent", sentAt: now },
    });

    sent++;
  }

  return { sent };
}
