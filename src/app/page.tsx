"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-2 text-white">
            <span className="text-2xl font-bold">SlotPilot</span>
          </div>
        </div>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Fill every cancelled slot automatically</h1>
          <p className="text-indigo-200 text-lg">
            When a patient cancels, SlotPilot instantly texts the next person on your waitlist.
            No staff time wasted. No revenue lost.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { stat: "30–40%", label: "reduction in no-shows with SMS reminders" },
              { stat: "$88K+", label: "average revenue lost per clinic per year to no-shows" },
              { stat: "15 min", label: "offer window before next patient is tried" },
            ].map((item) => (
              <div key={item.stat} className="flex items-center gap-4">
                <span className="text-2xl font-bold text-white">{item.stat}</span>
                <span className="text-indigo-200">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-indigo-300 text-sm">Built for physio, chiro & dental clinics</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold text-indigo-600">SlotPilot</h1>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to your clinic dashboard</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clinic@example.com"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New clinic?{" "}
            <Link href="/signup" className="text-indigo-600 font-medium hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 p-4 bg-indigo-50 rounded-lg text-sm text-indigo-700">
            <p className="font-medium mb-1">Demo account</p>
            <p>Email: demo@slotpilot.com · Password: demo1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
