"use client";
import { useEffect, useState, useCallback } from "react";

interface WaitlistEntry {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentType: string;
  preferredDays: string | null;
  preferredTime: string;
  priority: number;
  status: string;
  createdAt: string;
  notifications: Array<{ id: string; response: string; expiresAt: string; sentAt: string }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    waiting: "bg-amber-100 text-amber-700",
    notified: "bg-blue-100 text-blue-700",
    booked: "bg-emerald-100 text-emerald-700",
    declined: "bg-slate-100 text-slate-500",
    expired: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[status] ?? "bg-slate-100"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === "all" ? "/api/waitlist" : `/api/waitlist?status=${filter}`;
    const res = await fetch(url);
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function removeEntry(id: string) {
    if (!confirm("Remove this patient from the waitlist?")) return;
    await fetch(`/api/waitlist?id=${id}`, { method: "DELETE" });
    setActionMsg("Patient removed from waitlist");
    await load();
    setTimeout(() => setActionMsg(""), 3000);
  }

  async function setPriority(id: string, priority: number) {
    await fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority }),
    });
    await load();
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "waiting", label: "Waiting" },
    { key: "notified", label: "Notified" },
    { key: "booked", label: "Booked" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Waitlist</h1>
          <p className="text-sm text-slate-500 mt-1">Patients waiting for an available slot</p>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-4xl mb-2">≡</p>
            <p>No patients in the waitlist{filter !== "all" ? ` with status "${filter}"` : ""}.</p>
            <p className="text-sm mt-2">
              Share your join link with patients:{" "}
              <a href="/dashboard" className="text-indigo-600 hover:underline">find it in the sidebar</a>
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Appointment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Preferences</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{entry.patientName}</p>
                    <p className="text-xs text-slate-400">{entry.patientPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entry.appointmentType}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-slate-500">{entry.preferredDays || "Any day"}</p>
                    <p className="text-xs text-slate-400 capitalize">{entry.preferredTime}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                    {entry.status === "notified" && entry.notifications[0] && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Expires {new Date(entry.notifications[0].expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                    {timeAgo(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {entry.priority === 0 ? (
                        <button
                          onClick={() => setPriority(entry.id, 1)}
                          className="px-2.5 py-1.5 text-xs border border-amber-200 rounded-md hover:bg-amber-50 text-amber-600"
                          title="Set high priority"
                        >
                          ↑ Priority
                        </button>
                      ) : (
                        <button
                          onClick={() => setPriority(entry.id, 0)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-100 text-slate-500"
                        >
                          ↓ Normal
                        </button>
                      )}
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-400"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {entries.length > 0 && (
        <p className="mt-3 text-xs text-slate-400 text-right">
          {entries.length} patient{entries.length !== 1 ? "s" : ""} shown
        </p>
      )}
    </div>
  );
}
