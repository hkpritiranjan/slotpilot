"use client";
import { useEffect, useState } from "react";

interface Stats {
  totalToday: number;
  bookedToday: number;
  availableToday: number;
  noShowsToday: number;
  waiting: number;
  filledFromWaitlist: number;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  status: string;
  patientName: string | null;
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
  const [stats, setStats] = useState<Stats>({ totalToday: 0, bookedToday: 0, availableToday: 0, noShowsToday: 0, waiting: 0, filledFromWaitlist: 0 });
  const [clinicName, setClinicName] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    fetch("/api/clinic").then(r => r.json()).then(d => setClinicName(d?.name ?? ""));

    Promise.all([
      fetch(`/api/slots?date=${today}`).then(r => r.json()),
      fetch("/api/waitlist?status=waiting").then(r => r.json()),
    ]).then(([todaySlots, waitingList]) => {
      const s: Slot[] = Array.isArray(todaySlots) ? todaySlots : [];
      const w = Array.isArray(waitingList) ? waitingList : [];
      setSlots(s.slice(0, 6));
      setStats({
        totalToday: s.length,
        bookedToday: s.filter(x => x.status === "booked").length,
        availableToday: s.filter(x => x.status === "available").length,
        noShowsToday: s.filter(x => x.status === "no_show").length,
        waiting: w.length,
        filledFromWaitlist: s.filter(x => x.status === "booked").length,
      });
    });
  }, []);

  const statCards = [
    { label: "Today's slots", value: stats.totalToday, color: "text-slate-900" },
    { label: "Booked", value: stats.bookedToday, color: "text-blue-600" },
    { label: "Available", value: stats.availableToday, color: "text-emerald-600" },
    { label: "No-shows", value: stats.noShowsToday, color: "text-red-600" },
    { label: "On waitlist", value: stats.waiting, color: "text-indigo-600" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {clinicName ? `${clinicName}` : "Dashboard"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
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
            <a href="/dashboard/slots" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
              Add slots →
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {slots.map((slot) => (
              <li key={slot.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-slate-500 w-24">
                    {slot.startTime} – {slot.endTime}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{slot.appointmentType}</p>
                    {slot.patientName && (
                      <p className="text-xs text-slate-500">{slot.patientName}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={slot.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/dashboard/slots", title: "Manage Slots", desc: "Add, cancel or mark no-shows", icon: "◷" },
          { href: "/dashboard/waitlist", title: "View Waitlist", desc: "See who's waiting and for what", icon: "≡" },
          { href: "/dashboard/sms", title: "SMS Inbox", desc: "View messages & simulate replies", icon: "✉" },
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
