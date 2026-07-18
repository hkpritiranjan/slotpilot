# SlotPilot — Clinic Waitlist & No-Show Management System

> Automated appointment waitlist and no-show recovery for physiotherapy, chiropractic, and dental clinics. Built with Next.js 16, TypeScript, Prisma 7, and SQLite.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What It Does

Small clinics lose **$88,000–$240,000/year** to no-shows and unfilled cancellations. SlotPilot solves this with a two-part system:

1. **Patient waitlist** — patients join via a public link, specifying which appointment type they need and their preferred days/times
2. **Automatic slot recovery** — the moment a booked slot is cancelled or a patient no-shows, the system finds the next matching patient on the waitlist and sends them an SMS offer with a 15-minute response window

No phone calls. No staff time spent scrolling through a list. The slot either fills itself or it doesn't.

---

## Core Features

- **Automated waitlist engine** — matches cancelled slots to waiting patients by appointment type, priority, and join order
- **15-minute SMS offer window** — patient replies YES to book or NO to skip; system cascades to the next person automatically
- **Appointment reminders** — booked patients receive 24h and 2h SMS reminders, reducing no-show rates by 30–40%
- **No-show handling** — marking a no-show triggers the same waitlist cascade as a cancellation
- **Priority queue** — clinic staff can elevate urgent patients to jump the waitlist
- **Mock SMS inbox** — local development mode simulates the full SMS lifecycle with YES/NO simulation buttons
- **Multi-practitioner support** — slots can be assigned to specific practitioners within a clinic
- **Public patient join page** — shareable `/join/[clinic-slug]` link, no patient account required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| Database | SQLite via Prisma 7 + libsql driver adapter |
| Auth | JWT sessions via jose (stateless cookies) |
| Styling | Tailwind CSS v4 |
| Passwords | bcryptjs |
| Runtime | Node.js 22 |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # Login, signup, session, logout
│   │   ├── slots/         # CRUD + status transitions
│   │   ├── waitlist/      # Patient waitlist management
│   │   ├── sms/           # Mock SMS log + reply simulation
│   │   ├── reminders/     # 24h/2h reminder processing
│   │   └── clinic/        # Clinic settings
│   ├── dashboard/         # Clinic-side UI (slots, waitlist, SMS inbox)
│   ├── join/[slug]/       # Public patient waitlist signup
│   └── signup/            # Clinic registration
├── lib/
│   ├── db.ts              # Prisma client singleton
│   ├── session.ts         # JWT cookie auth
│   ├── sms.ts             # SMS abstraction (swap for Twilio/Plivo)
│   └── waitlist-engine.ts # Core slot-fill logic + reminder processing
└── generated/
    └── prisma/            # Generated Prisma client (Prisma 7)
```

### Waitlist Engine Flow

```
Slot cancelled / no-show
        ↓
Scan waitlist by appointment type + priority
        ↓
SMS offer sent → 15-minute window
        ↓
   YES reply → slot booked → confirmation SMS → reminders scheduled
   NO / timeout → next patient offered → repeat
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/hkpritiranjan/slotpilot.git
cd slotpilot
npm install
```

### Database Setup

```bash
npx prisma db push
npx prisma generate
npx tsx prisma/seed.ts   # Creates demo clinic account
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo credentials:** `demo@slotpilot.com` / `demo1234`

---

## End-to-End Demo Flow

1. Log in with the demo account
2. Go to **Slots** → add a slot with a patient booked
3. Go to **Join page** (`/join/city-physio`) → add yourself to the waitlist for the same appointment type
4. Back in **Slots** → click **Cancel** on the booked slot
5. See the green notification: *"Notifying [your name] from waitlist via SMS"*
6. Open **SMS Inbox** → click **Simulate YES**
7. Slot is now booked under your name with a confirmation SMS logged

---

## Production Readiness

This is a fully functional local prototype. To deploy:

| Concern | What to do |
|---|---|
| Real SMS | Replace `src/lib/sms.ts` mock with Plivo/Twilio API call — one file |
| Database | Migrate to Postgres (Supabase free tier) — change Prisma adapter |
| HIPAA compliance | Move to AWS with BAA, use HIPAA-eligible Twilio/Plivo plan |
| Auth | Current JWT sessions are production-safe; add rate limiting on login |
| Hosting | Railway, Render, or Vercel (Edge runtime compatible) |

---

## Problem Context

Healthcare appointment no-shows cost the US system an estimated **$150 billion/year**. For a small clinic:

- Physiotherapy: 10.4% no-show rate (peer-reviewed, 828 US clinics)
- Dental: 15–20% without reminders
- Chiropractic: ~16% average

This tool targets the **350,000+ small (1–5 practitioner) clinics** in the US, UK, and Canada that are underserved by enterprise scheduling software — too small for NexHealth ($299+/month) and too complex for generic booking tools.

---

## Why This Was Built

Built as a zero-investment prototype to validate the core thesis:

> *Can a solo developer build a working waitlist recovery system for small clinics in under 8 weeks, with no upfront capital?*

Answer: Yes. The full working system — auth, scheduling, waitlist engine, SMS simulation, reminders — is under 2,000 lines of code.

---

## License

MIT

---

*Keywords: healthcare SaaS, clinic management software, appointment scheduling system, patient waitlist management, no-show reduction, healthcare operations software, practice management, physiotherapy software, chiropractic clinic tool, dental practice management, SMS patient reminders, patient engagement platform, healthcare workflow automation, clinical scheduling, Next.js healthcare, TypeScript medical software, full-stack healthcare developer, HIPAA-ready appointment system, small clinic software, revenue cycle management*
