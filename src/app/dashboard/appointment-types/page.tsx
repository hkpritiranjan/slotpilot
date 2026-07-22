"use client";
import { useEffect, useState } from "react";
import { parseApptTypes, serializeApptTypes, type ApptType } from "@/lib/appointment-types";

const BLANK: ApptType = { name: "", durationMins: 30, fee: 0 };

export default function AppointmentTypesPage() {
  const [types, setTypes] = useState<ApptType[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<ApptType>(BLANK);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ApptType>(BLANK);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/clinic")
      .then((r) => r.json())
      .then((d) => setTypes(parseApptTypes(d?.appointmentTypes ?? "")));
  }, []);

  async function save(updated: ApptType[]) {
    setSaving(true);
    const res = await fetch("/api/clinic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentTypes: serializeApptTypes(updated) }),
    });
    if (res.ok) {
      setTypes(updated);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2500);
    }
    setSaving(false);
  }

  function startEdit(i: number) {
    setEditing(i);
    setEditBuf({ ...types[i] });
    setAdding(false);
  }

  function commitEdit() {
    if (!editBuf.name.trim()) return;
    const updated = types.map((t, i) => (i === editing ? { ...editBuf, name: editBuf.name.trim() } : t));
    setEditing(null);
    save(updated);
  }

  function deleteType(i: number) {
    if (!confirm(`Delete "${types[i].name}"? This won't affect existing slots.`)) return;
    save(types.filter((_, idx) => idx !== i));
  }

  function addType() {
    if (!newType.name.trim()) return;
    const updated = [...types, { ...newType, name: newType.name.trim() }];
    setNewType(BLANK);
    setAdding(false);
    save(updated);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointment Types</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define your services, durations, and fees. Fees are used to calculate revenue recovered.
          </p>
        </div>
        <button
          onClick={() => { setAdding(true); setEditing(null); setNewType(BLANK); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Add type
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          ✓ {msg}
        </div>
      )}

      {/* Fee explanation banner */}
      {types.some((t) => t.fee === 0) && (
        <div className="mb-5 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3 items-start">
          <span className="text-indigo-500 mt-0.5">💡</span>
          <p className="text-sm text-indigo-800 leading-relaxed">
            Set a <strong>consultation fee</strong> for each type. The dashboard will then show <strong>₹ revenue recovered</strong> each time the waitlist fills a cancelled slot automatically.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="col-span-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</div>
          <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</div>
          <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fee</div>
          <div className="col-span-1" />
        </div>

        {types.length === 0 && !adding && (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl mb-2">◈</p>
            <p>No appointment types yet.</p>
            <button
              onClick={() => setAdding(true)}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Add your first type →
            </button>
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {types.map((t, i) => (
            <li key={i}>
              {editing === i ? (
                <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-indigo-50">
                  <div className="col-span-5">
                    <input
                      autoFocus
                      value={editBuf.name}
                      onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. General Consultation"
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={5}
                        max={240}
                        step={5}
                        value={editBuf.durationMins}
                        onChange={(e) => setEditBuf((b) => ({ ...b, durationMins: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500 whitespace-nowrap">min</span>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-500">₹</span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={editBuf.fee}
                        onChange={(e) => setEditBuf((b) => ({ ...b, fee: Number(e.target.value) }))}
                        className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="col-span-1 flex gap-1 justify-end">
                    <button
                      onClick={commitEdit}
                      disabled={saving}
                      className="px-2 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-500 hover:bg-slate-100"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center hover:bg-slate-50 group">
                  <div className="col-span-5">
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-slate-600">{t.durationMins} min</p>
                  </div>
                  <div className="col-span-3">
                    {t.fee > 0 ? (
                      <p className="text-sm font-semibold text-emerald-700">₹{t.fee.toLocaleString("en-IN")}</p>
                    ) : (
                      <button
                        onClick={() => startEdit(i)}
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        Set fee →
                      </button>
                    )}
                  </div>
                  <div className="col-span-1 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(i)}
                      className="px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-500 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteType(i)}
                      className="px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Add new row */}
        {adding && (
          <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-emerald-50 border-t border-slate-100">
            <div className="col-span-5">
              <input
                autoFocus
                value={newType.name}
                onChange={(e) => setNewType((b) => ({ ...b, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addType()}
                className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Physiotherapy"
              />
            </div>
            <div className="col-span-3">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={newType.durationMins}
                  onChange={(e) => setNewType((b) => ({ ...b, durationMins: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">min</span>
              </div>
            </div>
            <div className="col-span-3">
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">₹</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={newType.fee}
                  onChange={(e) => setNewType((b) => ({ ...b, fee: Number(e.target.value) }))}
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="500"
                />
              </div>
            </div>
            <div className="col-span-1 flex gap-1 justify-end">
              <button
                onClick={addType}
                disabled={saving || !newType.name.trim()}
                className="px-2 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-xs text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Changes take effect immediately. Existing slots keep their appointment type label unchanged.
      </p>
    </div>
  );
}
