"use client";
import { useEffect, useState, useCallback } from "react";

interface PublicSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  practitioner: string | null;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function formatTabDate(dateStr: string): { weekday: string; day: string; isToday: boolean } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = todayStr();
  return {
    weekday: dt.toLocaleDateString("en-US", { weekday: "short" }),
    day: String(d),
    isToday: dateStr === today,
  };
}

function formatTime(t: string) {
  const [h, min] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${pad(min)}${ampm}`;
}

export default function BookingClient({
  slug,
  clinicName,
  clinicAddress,
  appointmentTypes,
}: {
  slug: string;
  clinicName: string;
  clinicAddress: string | null;
  appointmentTypes: string[];
}) {
  const today = todayStr();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const [form, setForm] = useState({
    patientName: "",
    patientPhone: "",
    channel: "whatsapp" as "whatsapp" | "sms",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ datetime: string } | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/public/${slug}/slots`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setSlots(data.slots ?? []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const slotsForDay = slots.filter((s) => s.date === selectedDate);
  const filtered = filterType === "all" ? slotsForDay : slotsForDay.filter((s) => s.appointmentType === filterType);
  const typesOnDay = [...new Set(slotsForDay.map((s) => s.appointmentType))];

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/public/${slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: selectedSlot.id, ...form }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      if (res.status === 409) {
        // slot taken — reload and close
        await loadSlots();
        setSelectedSlot(null);
      }
      return;
    }
    setDone({ datetime: data.datetime });
    await loadSlots();
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 text-4xl">✓</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking confirmed!</h1>
          <p className="text-slate-600 text-sm mb-1">
            Your appointment at <strong>{clinicName}</strong>
          </p>
          <p className="text-indigo-600 font-medium mb-6">{done.datetime}</p>
          <p className="text-slate-500 text-sm mb-8">
            We{form.channel === "whatsapp" ? " WhatsApp'd" : " texted"} a confirmation to{" "}
            <strong>{form.patientPhone}</strong>. You'll also get a reminder 24h and 2h before.
          </p>
          <button
            onClick={() => { setDone(null); setSelectedSlot(null); setForm({ patientName: "", patientPhone: "", channel: "whatsapp" }); }}
            className="text-sm text-indigo-600 underline"
          >
            Book another slot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white text-xl flex items-center justify-center shrink-0">◷</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{clinicName}</h1>
            {clinicAddress && <p className="text-sm text-slate-500">{clinicAddress}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Date tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
          {dates.map((d) => {
            const { weekday, day, isToday } = formatTabDate(d);
            const hasSlots = slots.some((s) => s.date === d);
            const active = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => { setSelectedDate(d); setFilterType("all"); }}
                className={`flex flex-col items-center min-w-[56px] py-2.5 px-3 rounded-xl border text-sm transition-colors shrink-0 ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-medium opacity-80">{isToday ? "Today" : weekday}</span>
                <span className="text-lg font-bold leading-tight">{day}</span>
                {hasSlots && (
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full ${active ? "bg-white/60" : "bg-indigo-500"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        {typesOnDay.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 ${filterType === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"}`}
            >
              All types
            </button>
            {typesOnDay.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 ${filterType === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Slot list */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading slots...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm mb-1">No available slots on this day</p>
            <p className="text-slate-400 text-xs">Try another date or join the waitlist below</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((slot) => (
              <button
                key={slot.id}
                onClick={() => { setSelectedSlot(slot); setError(""); }}
                className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
              >
                <div>
                  <span className="text-base font-semibold text-slate-900">
                    {formatTime(slot.startTime)}
                  </span>
                  <span className="text-slate-400 text-sm"> – {formatTime(slot.endTime)}</span>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {slot.appointmentType}
                    {slot.practitioner && ` · ${slot.practitioner}`}
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  Book
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Waitlist link */}
        <div className="mt-8 p-4 bg-white border border-slate-200 rounded-xl text-center">
          <p className="text-sm text-slate-600 mb-2">Can't find a suitable time?</p>
          <a
            href={`/join/${slug}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Join the waitlist →
          </a>
          <p className="text-xs text-slate-400 mt-1">We'll message you the moment a slot opens</p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by SlotPilot &middot; Your info is only used for this appointment
        </p>
      </div>

      {/* Booking modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            {/* Slot summary */}
            <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-5">
              <div className="text-sm font-semibold text-indigo-900">
                {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
              </div>
              <div className="text-xs text-indigo-700 mt-0.5">
                {selectedSlot.appointmentType}
                {selectedSlot.practitioner && ` · ${selectedSlot.practitioner}`}
              </div>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
                <input
                  type="text"
                  value={form.patientName}
                  onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                  placeholder="Jane Smith"
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number *</label>
                <input
                  type="tel"
                  value={form.patientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, patientPhone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Send confirmation via</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, channel: "whatsapp" }))}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.channel === "whatsapp" ? "bg-green-500 text-white border-green-500" : "bg-white text-slate-600 border-slate-300"
                    }`}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, channel: "sms" }))}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.channel === "sms" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"
                    }`}
                  >
                    📱 SMS
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setSelectedSlot(null); setError(""); }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Booking..." : "Confirm booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
