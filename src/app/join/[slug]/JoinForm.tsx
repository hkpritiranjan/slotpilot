"use client";
import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function JoinForm({
  clinicId,
  clinicName,
  appointmentTypes,
}: {
  clinicId: string;
  clinicName: string;
  appointmentTypes: string[];
}) {
  const [form, setForm] = useState({
    patientName: "",
    patientPhone: "",
    appointmentType: appointmentTypes[0] ?? "",
    preferredDays: [] as string[],
    preferredTime: "any",
    preferredChannel: "whatsapp" as "whatsapp" | "sms",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      preferredDays: f.preferredDays.includes(day)
        ? f.preferredDays.filter((d) => d !== day)
        : [...f.preferredDays, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          patientName: form.patientName,
          patientPhone: form.patientPhone,
          appointmentType: form.appointmentType,
          preferredDays: form.preferredDays.join(",") || null,
          preferredTime: form.preferredTime,
          preferredChannel: form.preferredChannel,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">You&apos;re on the list!</h2>
        <p className="text-slate-600 text-sm">
          We&apos;ll {form.preferredChannel === "whatsapp" ? "WhatsApp" : "text"}{" "}
          <strong>{form.patientPhone}</strong> as soon as a{" "}
          <strong>{form.appointmentType}</strong> slot opens at {clinicName}.
        </p>
        <p className="text-slate-500 text-xs mt-4">
          You&apos;ll have 15 minutes to confirm when we message you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
        <input
          type="text"
          value={form.patientName}
          onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
          placeholder="Jane Smith"
          required
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number *</label>
        <input
          type="tel"
          value={form.patientPhone}
          onChange={(e) => setForm((f) => ({ ...f, patientPhone: e.target.value }))}
          placeholder="+1 555 000 0000"
          required
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">We&apos;ll only use this to notify you about available slots</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">How should we contact you? *</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, preferredChannel: "whatsapp" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              form.preferredChannel === "whatsapp"
                ? "bg-green-500 text-white border-green-500"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>💬</span> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, preferredChannel: "sms" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              form.preferredChannel === "sms"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span>📱</span> SMS
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Appointment type *</label>
        <select
          value={form.appointmentType}
          onChange={(e) => setForm((f) => ({ ...f, appointmentType: e.target.value }))}
          required
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          {appointmentTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Preferred days (optional)</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                form.preferredDays.includes(day)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Preferred time</label>
        <select
          value={form.preferredTime}
          onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="any">Any time</option>
          <option value="morning">Morning (before 12pm)</option>
          <option value="afternoon">Afternoon (12pm–5pm)</option>
          <option value="evening">Evening (after 5pm)</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Joining..." : "Join the waitlist"}
      </button>
    </form>
  );
}
