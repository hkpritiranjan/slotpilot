import { db } from "./db";
import { sendSms } from "./sms";

const OFFER_WINDOW_MINUTES = 15;

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

  // Find the next waiting patient for this clinic + appointment type
  const candidate = await db.waitlistEntry.findFirst({
    where: {
      clinicId: slot.clinicId,
      appointmentType: slot.appointmentType,
      status: "waiting",
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

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

  await sendSms({
    clinicId: slot.clinicId,
    to: candidate.patientPhone,
    body: message,
    tag: "waitlist_offer",
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
    await sendSms({
      clinicId: notification.slot.clinicId,
      to: notification.waitlistEntry.patientPhone,
      body: `Confirmed! Your ${notification.slot.appointmentType} appointment at ${notification.slot.clinic.name} is booked for ${datetime}. See you then!`,
      tag: "booking_confirmed",
    });

    // Schedule reminders
    await createRemindersForSlot(notification.slotId);

    return { success: true, message: `Slot booked for ${notification.waitlistEntry.patientName}` };
  } else {
    await db.waitlistEntry.update({
      where: { id: notification.waitlistId },
      data: { status: "waiting" },
    });

    await sendSms({
      clinicId: notification.slot.clinicId,
      to: notification.waitlistEntry.patientPhone,
      body: `No problem! You're still on the waitlist at ${notification.slot.clinic.name}. We'll notify you when the next slot opens.`,
      tag: "waitlist_declined",
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

export async function processReminders(clinicId: string): Promise<{ sent: number }> {
  const now = new Date();
  let sent = 0;

  const pendingReminders = await db.reminder.findMany({
    where: {
      status: "pending",
      slot: {
        clinicId,
        status: "booked",
        patientPhone: { not: null },
      },
    },
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

    await sendSms({
      clinicId: slot.clinicId,
      to: slot.patientPhone!,
      body,
      tag: `reminder_${reminder.type}`,
    });

    await db.reminder.update({
      where: { id: reminder.id },
      data: { status: "sent", sentAt: now },
    });

    sent++;
  }

  return { sent };
}
