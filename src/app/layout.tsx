import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlotPilot — Clinic Waitlist & No-Show Manager",
  description: "Automatically fill cancelled appointment slots from your waitlist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
