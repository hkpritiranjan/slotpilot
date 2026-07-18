"use client";
import { useEffect, useState, useCallback } from "react";

interface SmsMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  direction: "inbound" | "outbound";
  tag: string | null;
  createdAt: string;
}

interface PendingNotification {
  id: string;
  expiresAt: string;
  sentAt: string;
  waitlistEntry: { patientName: string; patientPhone: string };
  slot: { date: string; startTime: string; appointmentType: string };
}

export default function SmsPage() {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [pending, setPending] = useState<PendingNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sms");
    const data = await res.json();
    setMessages(data.messages ?? []);
    setPending(data.pendingNotifications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function simulateReply(notificationId: string, response: "yes" | "no") {
    setReplyingId(notificationId);
    try {
      const res = await fetch("/api/sms/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, response }),
      });
      const data = await res.json();
      setActionMsg(data.message ?? (data.success ? "Reply processed" : "Error processing reply"));
      await load();
    } finally {
      setReplyingId(null);
      setTimeout(() => setActionMsg(""), 5000);
    }
  }

  async function processReminders() {
    const res = await fetch("/api/reminders", { method: "POST" });
    const data = await res.json();
    setActionMsg(`Reminders processed: ${data.sent} sent`);
    await load();
    setTimeout(() => setActionMsg(""), 5000);
  }

  function timeLabel(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function isExpired(expiresAt: string) {
    return new Date(expiresAt) < new Date();
  }

  const tagLabels: Record<string, string> = {
    waitlist_offer: "Waitlist offer",
    booking_confirmed: "Booking confirmed",
    waitlist_declined: "Declined",
    reminder_24h: "24h reminder",
    reminder_2h: "2h reminder",
    patient_reply: "Patient reply",
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">All messages sent & received (simulated locally)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={processReminders}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Check and send any due appointment reminders"
          >
            Send reminders
          </button>
          <button onClick={load} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
            ↻
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Pending offers requiring simulation */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Awaiting patient reply ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-4 ${isExpired(n.expiresAt) ? "border-slate-200 bg-slate-50 opacity-60" : "border-amber-200 bg-amber-50"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{n.waitlistEntry.patientName}</p>
                    <p className="text-xs text-slate-500">{n.waitlistEntry.patientPhone}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Offered: {n.slot.appointmentType} on {n.slot.date} at {n.slot.startTime}
                    </p>
                    <p className="text-xs mt-1">
                      {isExpired(n.expiresAt) ? (
                        <span className="text-slate-400">Offer expired</span>
                      ) : (
                        <span className="text-amber-700">
                          Expires {new Date(n.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </p>
                  </div>
                  {!isExpired(n.expiresAt) && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => simulateReply(n.id, "yes")}
                        disabled={replyingId === n.id}
                        className="px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {replyingId === n.id ? "..." : "Simulate YES"}
                      </button>
                      <button
                        onClick={() => simulateReply(n.id, "no")}
                        disabled={replyingId === n.id}
                        className="px-3 py-2 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                      >
                        {replyingId === n.id ? "..." : "Simulate NO"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message feed */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-2">✉</p>
          <p>No messages yet.</p>
          <p className="text-sm mt-2">Messages appear here when slots are cancelled and patients are notified.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            Message log ({messages.length})
          </h2>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-sm rounded-2xl px-4 py-3 ${
                  msg.direction === "outbound"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {msg.tag && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      msg.direction === "outbound"
                        ? "bg-indigo-500 text-indigo-100"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {tagLabels[msg.tag] ?? msg.tag}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{msg.body}</p>
                <div className={`flex items-center justify-between mt-2 gap-4 text-xs ${
                  msg.direction === "outbound" ? "text-indigo-200" : "text-slate-400"
                }`}>
                  <span>{msg.direction === "outbound" ? `To: ${msg.to}` : `From: ${msg.from}`}</span>
                  <span>{timeLabel(msg.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
