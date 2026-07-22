"use client";
import { useEffect, useState } from "react";

interface RecoveryStats {
  recoveredWeek: number;
  recoveredMonth: number;
  revenueWeek: number;
  revenueMonth: number;
  fillRate: number;
  avgFillMinutes: number | null;
  hasFees: boolean;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  status: string;
  patientName: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700",
    booked: "bg-blue-100 text-blue-700",
    cancelled: "bg-slate-100 text-slate-600",
    no_show: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    available: "Available",
    booked: "Booked",
    cancelled: "Cancelled",
    no_show: "No-show",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [todayStats, setTodayStats] = useState({ total: 0, booked: 0, available: 0, noShows: 0, waiting: 0 });
  const [recovery, setRecovery] = useState<RecoveryStats | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicSlug, setClinicSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [onboarding, setOnboarding] = useState<{ profileComplete: boolean; slotsCreated: boolean; hasPatient: boolean } | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    fetch("/api/clinic").then((r) => r.json()).then((d) => {
      setClinicName(d?.name ?? "");
      setClinicSlug(d?.slug ?? "");
    });
    fetch("/api/stats").then((r) => r.json()).then((d) => setRecovery(d));
    fetch("/api/onboarding").then((r) => r.json()).then((d) => setOnboarding(d));

    Promise.all([
      fetch(`/api/slots?date=${today}`).then((r) => r.json()),
      fetch("/api/waitlist?status=waiting").then((r) => r.json()),
    ]).then(([todaySlots, waitingList]) => {
      const s: Slot[] = Array.isArray(todaySlots) ? todaySlots : [];
      const w = Array.isArray(waitingList) ? waitingList : [];
      setSlots(s.slice(0, 6));
      setTodayStats({
        total: s.length,
        booked: s.filter((x) => x.status === "booked").length,
        available: s.filter((x) => x.status === "available").length,
        noShows: s.filter((x) => x.status === "no_show").length,
        waiting: w.length,
      });
    });
  }, []);

  const todayCards = [
    { label: "Today's slots", value: todayStats.total, color: "text-slate-900" },
    { label: "Booked", value: todayStats.booked, color: "text-blue-600" },
    { label: "Available", value: todayStats.available, color: "text-emerald-600" },
    { label: "No-shows", value: todayStats.noShows, color: "text-red-600" },
    { label: "On waitlist", value: todayStats.waiting, color: "text-indigo-600" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{clinicName || "Dashboard"}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Onboarding checklist — shown until all steps complete */}
      {onboarding && !(onboarding.profileComplete && onboarding.slotsCreated && onboarding.hasPatient) && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <span className="text-amber-500">◎</span>
            <span className="text-sm font-semibold text-amber-900">Get started — 3 steps to your first booking</span>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              {
                done: onboarding.profileComplete,
                label: "Complete your clinic profile",
                desc: "Add your phone number and address so patients trust your booking page.",
                href: "/dashboard/settings",
                cta: "Open settings",
              },
              {
                done: onboarding.slotsCreated,
                label: "Generate your first slots",
                desc: "Create a week of appointment slots so patients have something to book.",
                href: "/dashboard/slots",
                cta: "Go to slots",
              },
              {
                done: onboarding.hasPatient,
                label: "Get your first patient",
                desc: "Share your booking link — paste it on WhatsApp, Instagram bio, or Google Maps.",
                href: clinicSlug ? `/book/${clinicSlug}` : "#",
                cta: "Preview booking page",
                external: true,
              },
            ].map((step, i) => (
              <div key={i} className={`px-5 py-4 flex items-start gap-4 ${step.done ? "opacity-50" : ""}`}>
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${step.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-slate-300"}`}>
                  {step.done ? "✓" : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.done ? "line-through text-slate-400" : "text-slate-900"}`}>{step.label}</p>
                  {!step.done && <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>}
                </div>
                {!step.done && (
                  <a
                    href={step.href}
                    target={step.external ? "_blank" : undefined}
                    rel={step.external ? "noreferrer" : undefined}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    {step.cta}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's operational stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {todayCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recovery stats */}
      <div className="bg-white rounded-xl border border-indigo-200 mb-8 overflow-hidden">
        <div className="px-5 py-3.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-indigo-600">⚡</span>
            <span className="text-sm font-semibold text-indigo-900">Waitlist recovery</span>
          </div>
          {recovery && !recovery.hasFees && (
            <a href="/dashboard/appointment-types" className="text-xs text-indigo-600 hover:underline font-medium">
              Set consultation fees to track revenue →
            </a>
          )}
        </div>
        {!recovery ? (
          <div className="p-5 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">Recovered this week</p>
              <p className="text-2xl font-bold text-indigo-600">{recovery.recoveredWeek}</p>
              <p className="text-xs text-slate-400 mt-0.5">{recovery.recoveredMonth} this month</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">Revenue this week</p>
              {recovery.hasFees ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600">₹{fmt(recovery.revenueWeek)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">₹{fmt(recovery.revenueMonth)} this month</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-300">—</p>
                  <a href="/dashboard/appointment-types" className="text-xs text-indigo-500 hover:underline mt-0.5 block">Add fees →</a>
                </>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">Fill rate (30 days)</p>
              <p className={`text-2xl font-bold ${recovery.fillRate >= 70 ? "text-emerald-600" : recovery.fillRate >= 40 ? "text-amber-500" : "text-slate-700"}`}>
                {recovery.fillRate}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {recovery.fillRate >= 70 ? "Excellent" : recovery.fillRate >= 40 ? "Good" : recovery.recoveredMonth === 0 ? "No data yet" : "Room to improve"}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1">Avg fill time</p>
              {recovery.avgFillMinutes != null ? (
                <>
                  <p className="text-2xl font-bold text-slate-900">{recovery.avgFillMinutes}m</p>
                  <p className="text-xs text-slate-400 mt-0.5">minutes to confirm</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-300">—</p>
                  <p className="text-xs text-slate-400 mt-0.5">no data yet</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Today's schedule */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Today&apos;s schedule</h2>
          <a href="/dashboard/slots" className="text-sm text-indigo-600 hover:underline">View all →</a>
        </div>
        {slots.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-4xl mb-2">◷</p>
            <p>No slots for today yet.</p>
            <a href="/dashboard/calendar" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
              Open calendar to add slots →
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {slots.map((slot) => (
              <li key={slot.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-slate-500 w-24">{slot.startTime}–{slot.endTime}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{slot.appointmentType}</p>
                    {slot.patientName && <p className="text-xs text-slate-500">{slot.patientName}</p>}
                  </div>
                </div>
                <StatusBadge status={slot.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Booking page share banner */}
      {clinicSlug && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900">Your patient booking page</p>
            <p className="text-xs text-indigo-600 mt-0.5 truncate">
              {typeof window !== "undefined" ? window.location.origin : ""}/book/{clinicSlug}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                const url = `${window.location.origin}/book/${clinicSlug}`;
                navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <a
              href={`/book/${clinicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-medium rounded-lg hover:bg-indigo-50"
            >
              Preview
            </a>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { href: "/dashboard/calendar", title: "Calendar", desc: "Visual week & month view", icon: "▦" },
          { href: "/dashboard/slots", title: "Manage Slots", desc: "Add, cancel or mark no-shows", icon: "◷" },
          { href: "/dashboard/waitlist", title: "Waitlist", desc: "See who's waiting and for what", icon: "≡" },
          { href: "/dashboard/appointment-types", title: "Appt Types", desc: "Names, durations & fees", icon: "◈" },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <span className="text-2xl">{card.icon}</span>
            <h3 className="mt-2 font-semibold text-slate-900 group-hover:text-indigo-600">{card.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
