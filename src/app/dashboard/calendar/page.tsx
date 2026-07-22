"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseApptTypes } from "@/lib/appointment-types";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  notes: string | null;
  notifications?: { waitlistEntry: { patientName: string } }[];
}

interface DragState {
  dayIndex: number;
  startMin: number;
  endMin: number;
}

interface CreateForm {
  date: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  practitioner: string;
  patientName: string;
  patientPhone: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 80; // px per hour
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MIN = 15;
const GUTTER_W = 52; // px, time label column
const DEFAULT_APPT_TYPES = ["General Consultation", "Follow-up", "Assessment", "Treatment Session"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Utilities ───────────────────────────────────────────────────────────────

function toMin(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTime(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snap(min: number) {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

function clampMin(min: number) {
  return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, min));
}

function weekStart(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric" });
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-50 border-emerald-300 text-emerald-800",
  booked: "bg-blue-50 border-blue-300 text-blue-800",
  cancelled: "bg-slate-100 border-slate-300 text-slate-400",
  no_show: "bg-red-50 border-red-300 text-red-700",
};

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-400",
  booked: "bg-blue-500",
  cancelled: "bg-slate-400",
  no_show: "bg-red-400",
};

function slotStyle(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.available;
}

function slotDot(status: string) {
  return STATUS_DOT[status] ?? STATUS_DOT.available;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "month">("week");
  const [wStart, setWStart] = useState(() => weekStart(new Date()));
  const [monthD, setMonthD] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    date: "", startTime: "", endTime: "", appointmentType: DEFAULT_APPT_TYPES[0],
    practitioner: "", patientName: "", patientPhone: "",
  });
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [apptTypes, setApptTypes] = useState(DEFAULT_APPT_TYPES);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    let s: string, e: string;
    if (view === "week") {
      s = toISO(wStart);
      e = toISO(addDays(wStart, 6));
    } else {
      s = toISO(monthD);
      e = toISO(new Date(monthD.getFullYear(), monthD.getMonth() + 1, 0));
    }
    const res = await fetch(`/api/slots?startDate=${s}&endDate=${e}`);
    if (res.ok) setSlots(await res.json());
    setLoading(false);
  }, [view, wStart, monthD]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    fetch("/api/clinic").then(r => r.json()).then(d => {
      if (d.appointmentTypes) setApptTypes(parseApptTypes(d.appointmentTypes).map(t => t.name));
    }).catch(() => {});
  }, []);

  // Scroll week view to 8am on mount
  useEffect(() => {
    if (view === "week" && gridRef.current) {
      gridRef.current.scrollTop = HOUR_HEIGHT; // 1 hour = 8am
    }
  }, [view]);

  // ── Drag helpers ─────────────────────────────────────────────────────────

  function getPosFromEvent(e: React.MouseEvent): { dayIndex: number; minutes: number } | null {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + el.scrollTop;
    if (x < GUTTER_W) return null;
    const colW = (el.offsetWidth - GUTTER_W) / 7;
    const dayIndex = Math.floor((x - GUTTER_W) / colW);
    if (dayIndex < 0 || dayIndex > 6) return null;
    const rawMin = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    return { dayIndex, minutes: clampMin(snap(rawMin)) };
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Don't start drag when clicking a slot block
    if ((e.target as HTMLElement).closest("[data-slot]")) return;
    const pos = getPosFromEvent(e);
    if (!pos) return;
    isDragging.current = true;
    const startMin = pos.minutes;
    const endMin = Math.min(END_HOUR * 60, startMin + 30);
    setDrag({ dayIndex: pos.dayIndex, startMin, endMin });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !drag) return;
    const pos = getPosFromEvent(e);
    if (!pos || pos.dayIndex !== drag.dayIndex) return;
    const endMin = clampMin(snap(pos.minutes));
    if (endMin !== drag.startMin) {
      setDrag({ ...drag, endMin: Math.max(drag.startMin + SNAP_MIN, endMin) });
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!isDragging.current || !drag) { isDragging.current = false; return; }
    isDragging.current = false;
    const day = weekDays[drag.dayIndex];
    const startMin = Math.min(drag.startMin, drag.endMin);
    const endMin = Math.max(drag.startMin, drag.endMin);
    setCreateForm(f => ({
      ...f,
      date: toISO(day),
      startTime: toTime(startMin),
      endTime: toTime(endMin === startMin ? startMin + 30 : endMin),
      appointmentType: apptTypes[0] ?? DEFAULT_APPT_TYPES[0],
    }));
    setDrag(null);
    setShowCreate(true);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function createSlot() {
    setSaving(true);
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: createForm.date,
        startTime: createForm.startTime,
        endTime: createForm.endTime,
        appointmentType: createForm.appointmentType,
        practitioner: createForm.practitioner || undefined,
        patientName: createForm.patientName || undefined,
        patientPhone: createForm.patientPhone || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowCreate(false);
      fetchSlots();
      setActionMsg("Slot created");
      setTimeout(() => setActionMsg(""), 3000);
    }
  }

  async function patchSlot(id: string, status: string) {
    const res = await fetch(`/api/slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setDetailSlot(null);
      fetchSlots();
      const d = await res.json();
      const msg = d.waitlist?.notified
        ? `Slot ${status} — notifying ${d.waitlist.patientName} from waitlist`
        : `Slot marked ${status}`;
      setActionMsg(msg);
      setTimeout(() => setActionMsg(""), 4000);
    }
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/slots/${id}`, { method: "DELETE" });
    setDetailSlot(null);
    fetchSlots();
    setActionMsg("Slot deleted");
    setTimeout(() => setActionMsg(""), 3000);
  }

  // ── Slot positioning ─────────────────────────────────────────────────────

  function slotTop(startTime: string) {
    return ((toMin(startTime) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  }

  function slotHeight(startTime: string, endTime: string) {
    return Math.max(((toMin(endTime) - toMin(startTime)) / 60) * HOUR_HEIGHT, 20);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const todayStr = toISO(now);

  return (
    <div className="flex flex-col h-full max-w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {view === "week" ? (
            <>
              <button onClick={() => setWStart(d => addDays(d, -7))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm">←</button>
              <button onClick={() => setWStart(weekStart(new Date()))}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600">Today</button>
              <button onClick={() => setWStart(d => addDays(d, 7))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm">→</button>
              <span className="text-sm font-medium text-slate-700 ml-1">
                {fmtMonthYear(wStart)}
              </span>
            </>
          ) : (
            <>
              <button onClick={() => setMonthD(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm">←</button>
              <button onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setMonthD(d); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600">Today</button>
              <button onClick={() => setMonthD(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm">→</button>
              <span className="text-sm font-medium text-slate-700 ml-1">{fmtMonthYear(monthD)}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actionMsg && (
            <span className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">{actionMsg}</span>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button onClick={() => setView("week")}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "week" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              Week
            </button>
            <button onClick={() => setView("month")}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "month" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              Month
            </button>
          </div>
          <button
            onClick={() => {
              const d = view === "week" ? toISO(weekDays[0]) : toISO(monthD);
              setCreateForm(f => ({ ...f, date: d, startTime: "09:00", endTime: "09:30", appointmentType: apptTypes[0] ?? DEFAULT_APPT_TYPES[0] }));
              setShowCreate(true);
            }}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Add slot
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
      )}

      {/* ── Week View ──────────────────────────────────────────────────── */}
      {!loading && view === "week" && (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden flex-1">
          {/* Day header row */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} />
            {weekDays.map((day, i) => {
              const today = isToday(day);
              return (
                <div key={i} className="flex-1 py-2 text-center border-l border-slate-100">
                  <span className={`text-xs font-medium ${today ? "text-indigo-600" : "text-slate-500"}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold
                    ${today ? "bg-indigo-600 text-white" : "text-slate-700"}`}>
                    {fmtDay(day)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid — scrollable */}
          <div
            ref={gridRef}
            className="flex overflow-y-auto flex-1 select-none cursor-crosshair"
            style={{ maxHeight: "calc(100vh - 260px)" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { if (isDragging.current) { isDragging.current = false; setDrag(null); } }}
          >
            {/* Time gutter */}
            <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className="relative flex-shrink-0">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div key={i} style={{ height: HOUR_HEIGHT }} className="relative">
                  <span className="absolute -top-2.5 right-2 text-xs text-slate-400 tabular-nums">
                    {String((START_HOUR + i) % 24).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIndex) => {
              const dayStr = toISO(day);
              const daySlots = slots.filter(s => s.date === dayStr);
              const today = isToday(day);

              return (
                <div
                  key={dayIndex}
                  className={`flex-1 border-l border-slate-100 relative ${today ? "bg-indigo-50/30" : ""}`}
                  style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div key={i} style={{ top: i * HOUR_HEIGHT }}
                      className="absolute inset-x-0 border-t border-slate-100" />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div key={`h${i}`} style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      className="absolute inset-x-0 border-t border-dashed border-slate-100" />
                  ))}

                  {/* Current time indicator */}
                  {today && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60 && (
                    <div style={{ top: nowTop }} className="absolute inset-x-0 z-10 pointer-events-none">
                      <div className="h-0.5 bg-red-500" />
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute -left-1 -top-1" />
                    </div>
                  )}

                  {/* Drag preview */}
                  {drag && drag.dayIndex === dayIndex && (
                    <div
                      className="absolute inset-x-1 rounded-md bg-indigo-200 border-2 border-indigo-400 opacity-70 pointer-events-none z-20"
                      style={{
                        top: slotTop(toTime(Math.min(drag.startMin, drag.endMin))),
                        height: Math.max(slotHeight(toTime(Math.min(drag.startMin, drag.endMin)), toTime(Math.max(drag.startMin, drag.endMin))), 20),
                      }}
                    >
                      <div className="px-1.5 pt-0.5 text-xs font-medium text-indigo-700 truncate">
                        {fmtTime(toTime(Math.min(drag.startMin, drag.endMin)))} – {fmtTime(toTime(Math.max(drag.startMin, drag.endMin)))}
                      </div>
                    </div>
                  )}

                  {/* Slot blocks */}
                  {daySlots.map(slot => (
                    <div
                      key={slot.id}
                      data-slot="true"
                      onClick={() => setDetailSlot(slot)}
                      className={`absolute inset-x-1 rounded-md border px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all z-10 overflow-hidden ${slotStyle(slot.status)}`}
                      style={{
                        top: slotTop(slot.startTime) + 2,
                        height: Math.max(slotHeight(slot.startTime, slot.endTime) - 4, 18),
                      }}
                    >
                      <div className="text-xs font-semibold truncate leading-tight">
                        {fmtTime(slot.startTime)}
                        {slotHeight(slot.startTime, slot.endTime) >= 36 && ` – ${fmtTime(slot.endTime)}`}
                      </div>
                      {slotHeight(slot.startTime, slot.endTime) >= 36 && (
                        <div className="text-xs truncate opacity-80">{slot.appointmentType}</div>
                      )}
                      {slot.patientName && slotHeight(slot.startTime, slot.endTime) >= 52 && (
                        <div className="text-xs truncate opacity-70">{slot.patientName}</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Month View ─────────────────────────────────────────────────── */}
      {!loading && view === "month" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DAY_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          {(() => {
            const year = monthD.getFullYear(), month = monthD.getMonth();
            const firstDay = new Date(year, month, 1);
            const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
            const cells: (Date | null)[] = [];
            for (let i = 0; i < totalCells; i++) {
              const offset = i - startOffset;
              cells.push(offset >= 0 && offset < daysInMonth ? new Date(year, month, offset + 1) : null);
            }
            return (
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="h-24 bg-slate-50/50" />;
                  const dayStr = toISO(day);
                  const daySlots = slots.filter(s => s.date === dayStr);
                  const today = isToday(day);
                  return (
                    <div
                      key={i}
                      className="h-24 p-1.5 cursor-pointer hover:bg-indigo-50/40 transition-colors"
                      onClick={() => {
                        setWStart(weekStart(day));
                        setView("week");
                      }}
                    >
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1
                        ${today ? "bg-indigo-600 text-white" : "text-slate-700"}`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {daySlots.slice(0, 3).map(slot => (
                          <div key={slot.id} className="flex items-center gap-1 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${slotDot(slot.status)}`} />
                            <span className="text-xs text-slate-600 truncate leading-tight">
                              {fmtTime(slot.startTime)} {slot.appointmentType.split(" ")[0]}
                            </span>
                          </div>
                        ))}
                        {daySlots.length > 3 && (
                          <div className="text-xs text-indigo-500 font-medium">+{daySlots.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">New appointment slot</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={createForm.date}
                  onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start time</label>
                  <input type="time" value={createForm.startTime}
                    onChange={e => setCreateForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End time</label>
                  <input type="time" value={createForm.endTime}
                    onChange={e => setCreateForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Appointment type</label>
                <select value={createForm.appointmentType}
                  onChange={e => setCreateForm(f => ({ ...f, appointmentType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {apptTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Practitioner (optional)</label>
                <input type="text" placeholder="e.g. Dr. Smith" value={createForm.practitioner}
                  onChange={e => setCreateForm(f => ({ ...f, practitioner: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Pre-book for a patient (optional — leave blank to keep available)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Patient name</label>
                    <input type="text" placeholder="Name" value={createForm.patientName}
                      onChange={e => setCreateForm(f => ({ ...f, patientName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input type="tel" placeholder="+91..." value={createForm.patientPhone}
                      onChange={e => setCreateForm(f => ({ ...f, patientPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={createSlot} disabled={saving || !createForm.date || !createForm.startTime || !createForm.endTime}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Create slot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slot Detail Modal ─────────────────────────────────────────── */}
      {detailSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setDetailSlot(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">{detailSlot.appointmentType}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {new Date(detailSlot.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  {" · "}{fmtTime(detailSlot.startTime)} – {fmtTime(detailSlot.endTime)}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                { available: "bg-emerald-100 text-emerald-700", booked: "bg-blue-100 text-blue-700",
                  cancelled: "bg-slate-100 text-slate-500", no_show: "bg-red-100 text-red-700" }[detailSlot.status] ?? "bg-slate-100 text-slate-500"
              }`}>
                {detailSlot.status.replace("_", " ")}
              </span>
            </div>

            <div className="space-y-2 text-sm mb-5">
              {detailSlot.practitioner && (
                <div className="flex gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 flex-shrink-0">Practitioner</span>
                  <span>{detailSlot.practitioner}</span>
                </div>
              )}
              {detailSlot.patientName && (
                <div className="flex gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 flex-shrink-0">Patient</span>
                  <span>{detailSlot.patientName}</span>
                </div>
              )}
              {detailSlot.patientPhone && (
                <div className="flex gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 flex-shrink-0">Phone</span>
                  <span>{detailSlot.patientPhone}</span>
                </div>
              )}
              {detailSlot.notifications && detailSlot.notifications.length > 0 && (
                <div className="flex gap-2 text-slate-600">
                  <span className="text-slate-400 w-20 flex-shrink-0">Offer sent</span>
                  <span className="text-indigo-600">{detailSlot.notifications[0].waitlistEntry.patientName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {detailSlot.status === "booked" && (
                <button onClick={() => patchSlot(detailSlot.id, "no_show")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 text-slate-600 transition-colors">
                  Mark no-show
                </button>
              )}
              {(detailSlot.status === "available" || detailSlot.status === "booked") && (
                <button onClick={() => patchSlot(detailSlot.id, "cancelled")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 text-slate-600 transition-colors">
                  Cancel slot
                </button>
              )}
              <button onClick={() => deleteSlot(detailSlot.id)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 transition-colors">
                Delete
              </button>
              <button onClick={() => setDetailSlot(null)}
                className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
