import { db } from "./db";

export async function sendSms(opts: {
  clinicId: string;
  to: string;
  body: string;
  tag?: string;
}): Promise<void> {
  await db.smsMessage.create({
    data: {
      clinicId: opts.clinicId,
      to: opts.to,
      from: "SlotPilot",
      body: opts.body,
      direction: "outbound",
      tag: opts.tag ?? null,
    },
  });
}
