"use client";
import { useEffect, useState } from "react";

interface ClinicData {
  id: string;
  name: string;
  email: string;
  phone: string;
  slug: string;
  address: string;
  slotDuration: number;
}

export default function SettingsPage() {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", slotDuration: 30 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"booking" | "waitlist" | null>(null);

  useEffect(() => {
    fetch("/api/clinic")
      .then((r) => r.json())
      .then((d: ClinicData) => {
        setClinic(d);
        setForm({
          name: d.name ?? "",
          phone: d.phone ?? "",
          address: d.address ?? "",
          slotDuration: d.slotDuration ?? 30,
        });
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/clinic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    }
  }

  function copyLink(type: "booking" | "waitlist") {
    const base = window.location.origin;
    const url = type === "booking" ? `${base}/book/${clinic?.slug}` : `${base}/join/${clinic?.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!clinic) {
    return <div className="text-slate-400 text-sm">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Update your clinic profile and preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Clinic profile */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Clinic profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">Shown on your patient-facing booking page.</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clinic name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
                placeholder="123 Main Street, Mumbai 400001"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Scheduling preferences</h2>
          </div>
          <div className="p-5">
            <label className="block text-sm font-medium text-slate-700 mb-1">Default slot duration</label>
            <select
              value={form.slotDuration}
              onChange={(e) => setForm((f) => ({ ...f, slotDuration: Number(e.target.value) }))}
              className="w-full sm:w-48 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {[10, 15, 20, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">Used as the default when adding slots manually.</p>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Account</h2>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Login email</label>
              <p className="text-sm text-slate-700">{clinic.email}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Booking page URL (cannot be changed)</label>
              <p className="text-sm font-mono text-slate-600">/book/{clinic.slug}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
        </div>
      </form>

      {/* Patient links */}
      <div className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Patient links</h2>
          <p className="text-xs text-slate-500 mt-0.5">Share these links with your patients.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Booking page</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{typeof window !== "undefined" ? window.location.origin : ""}/book/{clinic.slug}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => copyLink("booking")}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                {copied === "booking" ? "Copied!" : "Copy"}
              </button>
              <a href={`/book/${clinic.slug}`} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">
                Preview
              </a>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Waitlist signup</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{typeof window !== "undefined" ? window.location.origin : ""}/join/{clinic.slug}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => copyLink("waitlist")}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
                {copied === "waitlist" ? "Copied!" : "Copy"}
              </button>
              <a href={`/join/${clinic.slug}`} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">
                Preview
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
