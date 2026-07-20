"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "◉" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "▦" },
  { href: "/dashboard/slots", label: "Slots", icon: "◷" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: "≡" },
  { href: "/dashboard/sms", label: "SMS Inbox", icon: "✉" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [clinicName, setClinicName] = useState("");
  const [slug, setSlug] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.authenticated) { router.push("/"); return; }
        setClinicName(d.clinicName);
        setSlug(d.clinicSlug);
      });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-slate-100">
          <span className="text-xl font-bold text-indigo-600">SlotPilot</span>
          {clinicName && <p className="text-xs text-slate-500 mt-0.5 truncate">{clinicName}</p>}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          {slug && (
            <div className="px-3 py-2 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Patient waitlist link</p>
              <a
                href={`/join/${slug}`}
                target="_blank"
                className="text-xs text-indigo-600 hover:underline break-all"
              >
                /join/{slug}
              </a>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <span className="text-xl">☰</span>
          </button>
          <span className="font-bold text-indigo-600">SlotPilot</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
