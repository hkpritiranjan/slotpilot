import { db } from "./db";

export type Channel = "sms" | "whatsapp";

export interface MessageOpts {
  clinicId: string;
  to: string;
  body: string;
  tag?: string;
  channel?: Channel;
}

// Ensure E.164 format (+digits)
function e164(phone: string): string {
  const stripped = phone.replace(/^whatsapp:/, "");
  if (stripped.startsWith("+")) return stripped;
  return `+${stripped.replace(/\D/g, "")}`;
}

async function sendViaTwilio(opts: MessageOpts): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const channel = opts.channel ?? "sms";

  if (!sid || !token) throw new Error("Twilio credentials not configured");

  const isWhatsApp = channel === "whatsapp";
  const from = isWhatsApp
    ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_FROM}`
    : process.env.TWILIO_FROM;
  const to = isWhatsApp ? `whatsapp:${e164(opts.to)}` : e164(opts.to);

  if (!from) throw new Error("TWILIO_FROM not configured");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: opts.body }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error ${res.status}: ${err}`);
  }

  const result = await res.json() as { sid?: string };
  console.log(`[Twilio] Sent ${isWhatsApp ? "WhatsApp" : "SMS"} to ${to} — SID: ${result.sid}`);
}

async function sendViaMeta(opts: MessageOpts): Promise<void> {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) throw new Error("Meta credentials not configured");

  // Meta expects digits only, no +
  const to = e164(opts.to).replace(/^\+/, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: opts.body },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta error ${res.status}: ${err}`);
  }
}

async function sendViaMSG91(opts: MessageOpts): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID ?? "SLOTPL";

  if (!authKey) throw new Error("MSG91_AUTH_KEY not configured");

  const phone = e164(opts.to).replace(/^\+/, ""); // strip +

  if (opts.channel === "whatsapp") {
    // MSG91 WhatsApp — requires pre-approved template; send as SMS fallback for now
    console.warn("[MSG91] WhatsApp not yet templated — falling back to SMS");
  }

  const res = await fetch("https://api.msg91.com/api/v2/sendsms", {
    method: "POST",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: senderId,
      route: "4",
      country: "91",
      sms: [{ message: opts.body, to: [phone] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MSG91 error ${res.status}: ${err}`);
  }
}

async function sendViaConsole(opts: MessageOpts): Promise<void> {
  const channel = opts.channel ?? "sms";
  console.log(
    `\n[SlotPilot ${channel.toUpperCase()}] → ${opts.to}` +
    `${opts.tag ? ` [${opts.tag}]` : ""}\n${opts.body}\n`
  );
}

export async function sendMessage(opts: MessageOpts): Promise<void> {
  const provider = (process.env.MESSAGE_PROVIDER ?? "console").toLowerCase();
  const channel = opts.channel ?? "sms";

  // Always persist to DB for the inbox
  await db.smsMessage.create({
    data: {
      clinicId: opts.clinicId,
      to: opts.to,
      from: provider === "console" ? "SlotPilot[dev]" : "SlotPilot",
      body: opts.body,
      direction: "outbound",
      tag: opts.tag ?? null,
    },
  });

  try {
    if (provider === "twilio") {
      await sendViaTwilio(opts);
    } else if (provider === "meta") {
      if (channel === "whatsapp") {
        await sendViaMeta(opts);
      } else {
        // Meta is WhatsApp-only; fall back to console for SMS
        await sendViaConsole(opts);
      }
    } else if (provider === "msg91") {
      await sendViaMSG91(opts);
    } else {
      await sendViaConsole(opts);
    }
  } catch (err) {
    console.error(`[sendMessage] Provider ${provider} failed:`, err);
    // Don't throw — message is already saved to DB; provider failure shouldn't crash the flow
  }
}

// Backward-compat alias (used by older code that hasn't been updated yet)
export async function sendSms(opts: {
  clinicId: string;
  to: string;
  body: string;
  tag?: string;
}): Promise<void> {
  return sendMessage({ ...opts, channel: "sms" });
}
