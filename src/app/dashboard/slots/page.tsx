"use client";
import { useEffect, useState, useCallback } from "react";
import { parseApptTypes } from "@/lib/appointment-types";

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  practitioner: string | null;
  status: string;
  patientName: string | null;
  patientPhone: string | null;
  notifications: Array<{ id: string; expiresAt: string; waitlistEntry: { patientName: string } }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    booked: "bg-blue-100 text-blue-700",
    cancelled: "bg-slate-100 text-slate-500",
    no_show: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    available: "Available",
    booked: "Booked",
    cancelled: "Cancelled",
    no_show: "No-show",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[status] ?? "bg-slate-100"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(str: string) {
  const [y, m, d] = str.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function nextMonday(): string {
  const d = new Date();
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function SlotsPage() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [apptTypes, setApptTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const [gen, setGen] = useState({
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"] as string[],
    startTime: "09:00",
    endTime: "13:00",
    durationMins: 30,
    appointmentType: "",
    practitioner: "",
    startDate: nextMonday(),
    weeksAhead: 2,
  });
  const [generating, setGenerating] = useState(false);

  function toggleGenDay(day: string) {
    setGen(g => ({
      ...g,
      days: g.days.includes(day) ? g.days.filter(d => d !== day) : [...g.days, day],
    }));
  }

  function previewCount(): number {
    const [sh, sm] = gen.startTime.split(":").map(Number);
    const [eh, em] = gen.endTime.split(":").map(Number);
    const perDay = Math.floor(((eh * 60 + em) - (sh * 60 + sm)) / gen.durationMins);
    return Math.max(0, perDay) * gen.days.length * gen.weeksAhead;
  }

  async function generateSlots(e: React.FormEvent) {
    e.preventDefault();
    if (!gen.days.length) return;
    setGenerating(true);
    const res = await fetch("/api/slots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gen),
    });
    const data = await res.json();
    setGenerating(false);
    setShowGenerate(false);
    if (res.ok) {
      setActionMsg(`✓ Created ${data.created} slots`);
      await loadSlots();
    } else {
      setActionMsg(data.error ?? "Failed to generate slots");
    }
    setTimeout(() => setActionMsg(""), 5000);
  }

  const [form, setForm] = useState({
    date: toDateStr(new Date()),
    startTime: "09:00",
    endTime: "09:30",
    appointmentType: "",
    practitioner: "",
    patientName: "",
    patientPhone: "",
    notes: "",
  });

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/slots?date=${date}`);
    const data = await res.json();
    setSlots(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetch("/api/clinic").then(r => r.json()).then(d => {
      if (d?.appointmentTypes) {
        const parsed = parseApptTypes(d.appointmentTypes).map(t => t.name);
        setApptTypes(parsed);
        setForm(f => ({ ...f, appointmentType: parsed[0] ?? "" }));
        setGen(g => ({ ...g, appointmentType: parsed[0] ?? "" }));
      }
    });
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function shiftDate(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(toDateStr(d));
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    if (res.ok) {
      setShowAdd(false);
      setActionMsg("Slot added");
      await loadSlots();
      setTimeout(() => setActionMsg(""), 3000);
    }
  }

  async function changeStatus(slotId: string, status: string) {
    const res = await fetch(`/api/slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.waitlist?.notified) {
      setActionMsg(`Slot ${status}. Notifying ${data.waitlist.patientName} from waitlist via SMS!`);
    } else if (data.waitlist?.notified === false) {
      setActionMsg(`Slot ${status}. No matching patients on waitlist.`);
    } else {
      setActionMsg(`Slot updated to ${status}`);
    }
    await loadSlots();
    setTimeout(() => setActionMsg(""), 5000);
  }

  async function deleteSlot(slotId: string) {
    if (!confirm("Delete this slot?")) return;
    await fetch(`/api/slots/${slotId}`, { method: "DELETE" });
    await loadSlots();
  }

  async function offerToWaitlist(slotId: string) {
    const res = await fetch(`/api/slots/${slotId}/notify`, { method: "POST" });
    const data = await res.json();
    if (data.notified) {
      setActionMsg(`Offer sent to ${data.patientName} via WhatsApp!`);
    } else {
      setActionMsg("No matching patients on the waitlist right now.");
    }
    await loadSlots();
    setTimeout(() => setActionMsg(""), 5000);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Slots</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowGenerate(true); setShowAdd(false); }}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            ⟳ Generate slots
          </button>
          <button
            onClick={() => { setForm(f => ({ ...f, date })); setShowAdd(true); setShowGenerate(false); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Add slot
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Date nav */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-sm">←</button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{formatDate(date)}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button onClick={() => shiftDate(1)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-sm">→</button>
        <button onClick={() => setDate(toDateStr(new Date()))} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-100">Today</button>
      </div>

      {/* Slots list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : slots.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-4xl mb-2">◷</p>
            <p>No slots for {formatDate(date)}</p>
            <button
              onClick={() => { setForm(f => ({ ...f, date })); setShowAdd(true); }}
              className="mt-3 text-sm text-indigo-600 hover:underline"
            >
              Add the first slot →
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">
                    {slot.startTime}–{slot.endTime}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900">{slot.appointmentType}</p>
                    {slot.practitioner && <p className="text-xs text-slate-400">{slot.practitioner}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {slot.patientName ? (
                      <div>
                        <p className="text-sm text-slate-900">{slot.patientName}</p>
                        {slot.patientPhone && <p className="text-xs text-slate-400">{slot.patientPhone}</p>}
                      </div>
                    ) : slot.notifications.length > 0 ? (
                      <span className="text-xs text-amber-600 font-medium">
                        Offer sent to {slot.notifications[0].waitlistEntry.patientName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={slot.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {slot.status === "available" && slot.notifications.length === 0 && (
                        <button
                          onClick={() => offerToWaitlist(slot.id)}
                          className="px-2.5 py-1.5 text-xs border border-indigo-200 rounded-md hover:bg-indigo-50 text-indigo-600 font-medium"
                        >
                          Offer to waitlist
                        </button>
                      )}
                      {slot.status === "available" && (
                        <button
                          onClick={() => changeStatus(slot.id, "cancelled")}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600"
                        >
                          Cancel
                        </button>
                      )}
                      {slot.status === "booked" && (
                        <>
                          <button
                            onClick={() => changeStatus(slot.id, "no_show")}
                            className="px-2.5 py-1.5 text-xs border border-red-200 rounded-md hover:bg-red-50 text-red-600"
                          >
                            No-show
                          </button>
                          <button
                            onClick={() => changeStatus(slot.id, "cancelled")}
                            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-400"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add slot modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add appointment slot</h2>
            <form onSubmit={addSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Appointment type</label>
                  <select value={form.appointmentType} onChange={(e) => setForm(f => ({ ...f, appointmentType: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                    {apptTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start time</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End time</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Practitioner (optional)</label>
                <input type="text" value={form.practitioner} onChange={(e) => setForm(f => ({ ...f, practitioner: e.target.value }))}
                  placeholder="Dr. Smith"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Pre-book a patient (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient name</label>
                    <input type="text" value={form.patientName} onChange={(e) => setForm(f => ({ ...f, patientName: e.target.value }))}
                      placeholder="Jane Doe"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient phone</label>
                    <input type="tel" value={form.patientPhone} onChange={(e) => setForm(f => ({ ...f, patientPhone: e.target.value }))}
                      placeholder="+1 555 0000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Add slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate slots modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Generate recurring slots</h2>
            <p className="text-sm text-slate-500 mb-5">Fill your schedule without creating slots one by one.</p>
            <form onSubmit={generateSlots} className="space-y-4">

              {/* Days of week */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Days of the week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleGenDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        gen.days.includes(day)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time range + duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start time</label>
                  <input type="time" value={gen.startTime}
                    onChange={e => setGen(g => ({ ...g, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End time</label>
                  <input type="time" value={gen.endTime}
                    onChange={e => setGen(g => ({ ...g, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
                  <select value={gen.durationMins}
                    onChange={e => setGen(g => ({ ...g, durationMins: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {[15, 20, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
              </div>

              {/* Type + practitioner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Appointment type</label>
                  <select value={gen.appointmentType}
                    onChange={e => setGen(g => ({ ...g, appointmentType: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                    {apptTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Practitioner (optional)</label>
                  <input type="text" value={gen.practitioner}
                    onChange={e => setGen(g => ({ ...g, practitioner: e.target.value }))}
                    placeholder="Dr. Smith"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Start date + weeks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Starting from</label>
                  <input type="date" value={gen.startDate}
                    onChange={e => setGen(g => ({ ...g, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">For how many weeks</label>
                  <select value={gen.weeksAhead}
                    onChange={e => setGen(g => ({ ...g, weeksAhead: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {[1, 2, 4, 8, 12].map(w => <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>)}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {gen.days.length > 0 && previewCount() > 0 && (
                <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">
                  This will create <strong>{previewCount()} slots</strong> — {gen.days.length} day{gen.days.length > 1 ? "s" : ""} × {Math.floor(((gen.endTime.split(":").map(Number).reduce((a,b,i)=>a+(i===0?b*60:b),0))-(gen.startTime.split(":").map(Number).reduce((a,b,i)=>a+(i===0?b*60:b),0)))/gen.durationMins)} per day × {gen.weeksAhead} weeks
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowGenerate(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={generating || gen.days.length === 0 || previewCount() === 0}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {generating ? "Generating..." : `Generate ${previewCount()} slots`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
